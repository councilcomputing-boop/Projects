"""GroupMe Likes — local viewer for who liked what in one GroupMe group."""
import json
import os
import sqlite3
from contextlib import closing

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

load_dotenv()

# --- Config ---------------------------------------------------------------
API_BASE = "https://api.groupme.com/v3"
TOKEN = os.getenv("GROUPME_TOKEN", "").strip()
GROUP_ID = os.getenv("GROUPME_GROUP_ID", "").strip()
DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "groupme.db"))
PAGE_SIZE = 100          # GroupMe max per request
REQUEST_TIMEOUT = 20     # seconds
MAX_ROWS = 1000          # rows returned to the page per query
HOST = "127.0.0.1"
PORT = int(os.getenv("PORT", "5000"))

app = Flask(__name__)


# --- Database -------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with closing(get_db()) as conn, conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id          TEXT PRIMARY KEY,
                created_at  INTEGER NOT NULL,
                user_id     TEXT,
                name        TEXT,
                text        TEXT,
                like_count  INTEGER NOT NULL DEFAULT 0,
                raw         TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_messages_likes ON messages(like_count);

            CREATE TABLE IF NOT EXISTS likes (
                message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                user_id     TEXT NOT NULL,
                PRIMARY KEY (message_id, user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

            -- user_id -> display name (from group members, falling back to sender names)
            CREATE TABLE IF NOT EXISTS members (
                user_id     TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                source      TEXT NOT NULL
            );
            """
        )


def upsert_messages(conn, messages):
    for m in messages:
        liked_by = m.get("favorited_by") or []
        conn.execute(
            """INSERT INTO messages (id, created_at, user_id, name, text, like_count, raw)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name, text = excluded.text,
                   like_count = excluded.like_count, raw = excluded.raw""",
            (m["id"], m["created_at"], m.get("user_id"), m.get("name"),
             m.get("text"), len(liked_by), json.dumps(m)),
        )
        conn.execute("DELETE FROM likes WHERE message_id = ?", (m["id"],))
        conn.executemany(
            "INSERT OR IGNORE INTO likes (message_id, user_id) VALUES (?, ?)",
            [(m["id"], uid) for uid in liked_by],
        )
        # Sender names fill gaps for people who have left the group.
        # Never overwrite a name that came from the member list.
        if m.get("user_id") and m.get("name"):
            conn.execute(
                """INSERT INTO members (user_id, name, source) VALUES (?, ?, 'sender')
                   ON CONFLICT(user_id) DO UPDATE SET name = excluded.name
                   WHERE members.source = 'sender'""",
                (m["user_id"], m["name"]),
            )


# --- GroupMe API ----------------------------------------------------------
class GroupMeError(Exception):
    pass


def api_get(path, params=None):
    resp = requests.get(
        f"{API_BASE}{path}",
        params=params or {},
        headers={"X-Access-Token": TOKEN},
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code == 304:  # GroupMe's "no more messages"
        return None
    if resp.status_code == 401:
        raise GroupMeError("GroupMe rejected the token (401). Check GROUPME_TOKEN in .env.")
    if resp.status_code == 404:
        raise GroupMeError("Group not found (404). Check GROUPME_GROUP_ID in .env.")
    if not resp.ok:
        raise GroupMeError(f"GroupMe API error {resp.status_code}: {resp.text[:200]}")
    return resp.json().get("response")


def sync_members(conn):
    group = api_get(f"/groups/{GROUP_ID}")
    for mem in (group or {}).get("members", []):
        conn.execute(
            """INSERT INTO members (user_id, name, source) VALUES (?, ?, 'member')
               ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, source = 'member'""",
            (mem["user_id"], mem.get("nickname") or mem.get("name") or mem["user_id"]),
        )
    return (group or {}).get("name")


def fetch_older(conn, before_id=None):
    """Page backwards with before_id until history runs out."""
    count = 0
    while True:
        params = {"limit": PAGE_SIZE}
        if before_id:
            params["before_id"] = before_id
        data = api_get(f"/groups/{GROUP_ID}/messages", params)
        msgs = (data or {}).get("messages") or []
        if not msgs:
            break
        upsert_messages(conn, msgs)
        conn.commit()
        count += len(msgs)
        before_id = msgs[-1]["id"]  # newest-first, so last is oldest
    return count


def fetch_newer(conn, after_id):
    """Page forwards with after_id to pick up messages newer than the cache."""
    count = 0
    while True:
        data = api_get(f"/groups/{GROUP_ID}/messages", {"limit": PAGE_SIZE, "after_id": after_id})
        msgs = (data or {}).get("messages") or []
        if not msgs:
            break
        upsert_messages(conn, msgs)
        conn.commit()
        count += len(msgs)
        after_id = max(msgs, key=lambda m: m["created_at"])["id"]
        if len(msgs) < PAGE_SIZE:
            break
    return count


def sync(full=False):
    """Initial / full sync pages all history; otherwise fetch only new messages."""
    with closing(get_db()) as conn:
        group_name = sync_members(conn)
        conn.commit()
        newest = conn.execute(
            "SELECT id FROM messages ORDER BY created_at DESC, id DESC LIMIT 1"
        ).fetchone()
        if full or newest is None:
            fetched = fetch_older(conn)
        else:
            fetched = fetch_newer(conn, newest["id"])
        total = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    return {"fetched": fetched, "total": total, "group": group_name}


# --- Routes ---------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", configured=bool(TOKEN and GROUP_ID))


@app.route("/api/messages")
def api_messages():
    zero_only = request.args.get("zero") == "1"
    start = request.args.get("start", type=int)  # epoch seconds, inclusive
    end = request.args.get("end", type=int)      # epoch seconds, exclusive
    liker = request.args.get("liker", "").strip()
    sort = request.args.get("sort", "time")
    direction = "ASC" if request.args.get("dir") == "asc" else "DESC"

    where, params = [], []
    if zero_only:
        where.append("m.like_count = 0")
    if start is not None:
        where.append("m.created_at >= ?")
        params.append(start)
    if end is not None:
        where.append("m.created_at < ?")
        params.append(end)
    if liker:
        where.append(
            """EXISTS (SELECT 1 FROM likes l JOIN members u ON u.user_id = l.user_id
                       WHERE l.message_id = m.id AND u.name LIKE ?)"""
        )
        params.append(f"%{liker}%")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    order_sql = {
        "likes": f"m.like_count {direction}, m.created_at DESC",
        "time": f"m.created_at {direction}",
    }.get(sort, f"m.created_at {direction}")

    with closing(get_db()) as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM messages m {where_sql}", params).fetchone()[0]
        rows = conn.execute(
            f"""SELECT m.id, m.created_at, m.name, m.text, m.like_count,
                       (SELECT group_concat(COALESCE(u.name, l.user_id), ', '
                                            ORDER BY COALESCE(u.name, l.user_id) COLLATE NOCASE)
                          FROM likes l LEFT JOIN members u ON u.user_id = l.user_id
                         WHERE l.message_id = m.id) AS liked_by
                  FROM messages m {where_sql}
                 ORDER BY {order_sql}
                 LIMIT ?""",
            params + [MAX_ROWS],
        ).fetchall()
        cached = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]

    return jsonify({
        "total": total,
        "cached": cached,
        "limit": MAX_ROWS,
        "rows": [dict(r) for r in rows],
    })


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    if not (TOKEN and GROUP_ID):
        return jsonify({"error": "GROUPME_TOKEN and GROUPME_GROUP_ID must be set in .env"}), 400
    try:
        result = sync(full=request.args.get("full") == "1")
    except GroupMeError as e:
        return jsonify({"error": str(e)}), 502
    except requests.RequestException as e:
        return jsonify({"error": f"Could not reach GroupMe: {e}"}), 502
    return jsonify(result)


init_db()

if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=False)
