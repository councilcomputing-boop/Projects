import { getStore } from "@netlify/blobs";
import { checkPassword, errorResponse, json, sync } from "../lib/groupme.mjs";

export default async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    checkPassword(req);
    const url = new URL(req.url);
    return json(await sync(getStore("groupme"), {
      full: url.searchParams.get("full") === "1",
      cursor: url.searchParams.get("cursor"),
    }));
  } catch (e) {
    return errorResponse(e);
  }
};

export const config = { path: "/api/refresh" };
