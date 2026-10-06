// Shared logic for the Netlify version: GroupMe sync, storage, and row building.
// Storage is a Netlify Blobs store (or any object with get/setJSON) holding:
//   "messages" -> { [id]: { id, t, uid, s, x, likes: [user_id] } }
//   "members"  -> { [user_id]: { name, roles: [..], current: bool } }
//   "meta"     -> { group, lastSync }
import { createHash, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.groupme.com/v3";
const PAGE_SIZE = 100;            // GroupMe max per request
const TIME_BUDGET_MS = 7000;      // stay under Netlify's 10s function limit
const EXCLUDE_ROLES = new Set(["admin", "owner"]);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function config() {
  const token = (process.env.GROUPME_TOKEN || "").trim();
  const groupId = (process.env.GROUPME_GROUP_ID || "").trim();
  if (!token || !groupId) {
    throw new HttpError(500, "GROUPME_TOKEN and GROUPME_GROUP_ID must be set in Netlify environment variables.");
  }
  const exclude = new Set((process.env.NOT_LIKED_EXCLUDE || "").split(",").map(s => s.trim()).filter(Boolean));
  return { token, groupId, exclude };
}

// --- Password check ------------------------------------------------------
const sha = s => createHash("sha256").update(s).digest();

export function checkPassword(req) {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) throw new HttpError(500, "APP_PASSWORD is not set in Netlify environment variables.");
  const given = req.headers.get("x-app-password") || "";
  if (!timingSafeEqual(sha(given), sha(expected))) throw new HttpError(401, "Wrong password.");
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function errorResponse(e) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: "Server error: " + (e.message || e) }, 500);
}

// --- GroupMe API -----------------------------------------------------------
async function apiGet(cfg, path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url, { headers: { "X-Access-Token": cfg.token } });
  if (resp.status === 304) return null;  // GroupMe's "no more messages"
  if (resp.status === 401) throw new HttpError(502, "GroupMe rejected the token (401). Check GROUPME_TOKEN.");
  if (resp.status === 404) throw new HttpError(502, "Group not found (404). Check GROUPME_GROUP_ID.");
  if (!resp.ok) throw new HttpError(502, `GroupMe API error ${resp.status}`);
  return (await resp.json()).response;
}

// --- Sync --------------------------------------------------------------------
// Pages backwards from the newest message with before_id. A normal refresh stops
// once a page overlaps what is already cached (re-reading that page also updates
// like counts on recent messages). A full re-sync keeps going to the very start.
// Each call stops after TIME_BUDGET_MS and returns a cursor; the page calls again
// with that cursor until `more` is false.
export async function sync(store, { full = false, cursor = null } = {}) {
  const cfg = config();
  const started = Date.now();
  const messages = (await store.get("messages", { type: "json" })) || {};
  const members = (await store.get("members", { type: "json" })) || {};
  const meta = (await store.get("meta", { type: "json" })) || {};
  const firstSync = Object.keys(messages).length === 0;

  if (!cursor) {
    const group = await apiGet(cfg, `/groups/${cfg.groupId}`);
    for (const m of Object.values(members)) m.current = false;
    for (const mem of group?.members || []) {
      members[mem.user_id] = {
        name: mem.nickname || mem.name || mem.user_id,
        roles: mem.roles || [],
        current: true,
      };
    }
    meta.group = group?.name || meta.group;
  }

  let beforeId = cursor;
  let fetched = 0;
  let more = false;
  while (true) {
    const params = { limit: PAGE_SIZE };
    if (beforeId) params.before_id = beforeId;
    const data = await apiGet(cfg, `/groups/${cfg.groupId}/messages`, params);
    const page = data?.messages || [];
    if (page.length === 0) break;

    let overlap = false;
    for (const m of page) {
      if (messages[m.id]) overlap = true;
      messages[m.id] = {
        id: m.id, t: m.created_at, uid: m.user_id, s: m.name, x: m.text || "",
        likes: m.favorited_by || [],
      };
      // Sender names fill gaps for people no longer in the group
      if (m.user_id && m.name && !members[m.user_id]?.current) {
        members[m.user_id] = { name: m.name, roles: [], current: false };
      }
    }
    fetched += page.length;
    beforeId = page[page.length - 1].id;  // newest-first, so last is oldest

    if (!full && !firstSync && overlap) break;
    if (Date.now() - started > TIME_BUDGET_MS) { more = true; break; }
  }

  meta.lastSync = Math.floor(Date.now() / 1000);
  await store.setJSON("messages", messages);
  await store.setJSON("members", members);
  await store.setJSON("meta", meta);
  return { fetched, total: Object.keys(messages).length, group: meta.group, more, cursor: more ? beforeId : null };
}

// --- Rows for the page ---------------------------------------------------------
export function lastNameKey(name) {
  const words = name.replace(/\s*\(.*\)\s*$/, "").split(/\s+/).filter(Boolean);
  return [(words.length ? words[words.length - 1] : name).toLowerCase(), name.toLowerCase()];
}

export function byLastName(a, b) {
  const [ka, kb] = [lastNameKey(a), lastNameKey(b)];
  return ka[0] < kb[0] ? -1 : ka[0] > kb[0] ? 1 : ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0;
}

export async function buildData(store) {
  const { exclude } = config();
  const messages = (await store.get("messages", { type: "json" })) || {};
  const members = (await store.get("members", { type: "json" })) || {};
  const meta = (await store.get("meta", { type: "json" })) || {};

  const current = Object.entries(members).filter(([, m]) => m.current);
  const excluded = new Set(exclude);
  for (const [id, m] of current) if (m.roles.some(r => EXCLUDE_ROLES.has(r))) excluded.add(id);

  const rows = Object.values(messages)
    .sort((a, b) => b.t - a.t)
    .map(m => {
      const likers = new Set(m.likes);
      return {
        t: m.t, s: m.s, x: m.x, n: m.likes.length,
        l: m.likes.map(id => members[id]?.name || id).sort(byLastName),
        nl: current
          .filter(([id]) => !likers.has(id) && id !== m.uid && !excluded.has(id))
          .map(([, u]) => u.name)
          .sort(byLastName),
      };
    });
  return { group: meta.group || null, lastSync: meta.lastSync || null, rows };
}
