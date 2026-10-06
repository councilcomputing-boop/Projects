"""Export the cached messages to a single static page for Netlify drag-and-drop.

Run after clicking Refresh in the local app:
    python export_static.py
Then drag the netlify-drop folder onto https://app.netlify.com/drop
"""
import json
import os
import time
from contextlib import closing

from app import (GROUP_ID, HIDE_USERS, NOT_LIKED_EXCLUDE, NOT_LIKED_EXCLUDE_ROLES, GroupMeError,
                 api_get, get_db, last_name_key)
import requests

OUT_DIR = os.path.join(os.path.dirname(__file__), "netlify-drop")
TEMPLATE = os.path.join(os.path.dirname(__file__), "templates", "static.html")


def build_rows(conn):
    members = conn.execute("SELECT user_id, name, roles, source FROM members").fetchall()
    names = {m["user_id"]: m["name"] for m in members}
    current = [m for m in members if m["source"] == "member"]
    excluded = NOT_LIKED_EXCLUDE | HIDE_USERS | {
        m["user_id"] for m in current if set(m["roles"].split(",")) & NOT_LIKED_EXCLUDE_ROLES
    }

    likes = {}
    for message_id, user_id in conn.execute("SELECT message_id, user_id FROM likes"):
        likes.setdefault(message_id, set()).add(user_id)

    rows = []
    for m in conn.execute(
        "SELECT id, created_at, user_id, name, text, like_count FROM messages ORDER BY created_at DESC"
    ):
        likers = likes.get(m["id"], set()) - HIDE_USERS
        not_liked = [u["name"] for u in current
                     if u["user_id"] not in likers and u["user_id"] != m["user_id"]
                     and u["user_id"] not in excluded]
        rows.append({
            "t": m["created_at"],
            "s": m["name"],
            "x": m["text"],
            "n": len(likers),
            "l": sorted((names.get(u, u) for u in likers), key=last_name_key),
            "nl": sorted(not_liked, key=last_name_key),
        })
    return rows


def group_name():
    try:
        return (api_get(f"/groups/{GROUP_ID}") or {}).get("name")
    except (GroupMeError, requests.RequestException):
        return None  # offline: the page falls back to "GroupMe Likes"


def main():
    with closing(get_db()) as conn:
        rows = build_rows(conn)
    if not rows:
        raise SystemExit("No messages cached. Run the local app and click Refresh first.")

    data = json.dumps({"group": group_name(), "exported": int(time.time()), "rows": rows}, ensure_ascii=False)
    data = data.replace("</", "<\\/")  # keep message text from closing the <script> tag

    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read().replace("/*__DATA__*/null", data)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, "index.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Wrote {len(rows)} messages to {out}")


if __name__ == "__main__":
    main()
