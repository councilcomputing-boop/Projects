# GroupMe Likes

A small local web app that downloads one GroupMe group's message history and shows who liked what.

- Flask backend, SQLite cache (`groupme.db`)
- Table: time, sender, text, like count, liked by
- Filters: zero likes only, sender name, liked-by name
- Sort by time or like count (use the dropdown or click a column header)
- Runs on `127.0.0.1` only

## Setup

1. **Get your access token:** log in at <https://dev.groupme.com> and click **Access Token** in the top right.
2. **Find the group ID.** Either:
   - open the group at <https://web.groupme.com>. The number in the URL (`/chats/<id>`) is the group ID, or
   - run the following, replacing `YOUR_TOKEN` (PowerShell users: run it as `curl.exe`):
     ```
     curl "https://api.groupme.com/v3/groups?per_page=100&omit=memberships" -H "X-Access-Token: YOUR_TOKEN"
     ```
     and find the `id` next to your group's `name`.
3. **Create `.env`:**
   ```
   cp .env.example .env
   ```
   Then fill in `GROUPME_TOKEN` and `GROUPME_GROUP_ID`. `.env` is git-ignored. Never commit it.
4. **Install dependencies** (Python 3.10+):
   ```
   python -m venv venv
   # Windows:      venv\Scripts\activate
   # macOS/Linux:  source venv/bin/activate
   pip install -r requirements.txt
   ```

## Run

```
python app.py
```

Open <http://127.0.0.1:5000>.

- **Refresh** fetches new messages. The first time, it pages through the whole history with `before_id`, which can take a minute for large groups. After that, it only fetches messages newer than the newest one in the cache.
- **Re-sync all** downloads the full history again. Use it to update like counts on older messages, because likes added after a message was cached don't show up through Refresh.

## Notes

- GroupMe reports likes as user IDs. They're turned into names using the group's current member list. People who have left the group fall back to the name they last posted under, or to their raw ID if they never posted.
- The table shows up to 1,000 rows at a time. Use the filters to narrow it down.
- To start over, delete `groupme.db`.
