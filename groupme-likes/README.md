# GroupMe Likes

A small local web app that downloads one GroupMe group's message history and shows who liked what.

- Flask backend, SQLite cache (`groupme.db`)
- Table: time, sender, text, like count, liked by
- Filters: zero likes only, date range (From/To, inclusive), liked-by name
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

## Live version on Netlify

`public/` (the page) and `netlify/` (two functions) make a password-protected copy that refreshes from GroupMe on its own. Messages are stored in Netlify Blobs.

**One-time setup**
1. In Netlify: **Add new site → Import an existing project → GitHub**, then pick the `Projects` repo.
2. Set **Base directory** to `groupme-likes`. The rest is read from `groupme-likes/netlify.toml`.
3. Before deploying, add these under **Environment variables**:

   | Key | Value |
   |-----|-------|
   | `GROUPME_TOKEN` | your GroupMe access token |
   | `GROUPME_GROUP_ID` | the group ID |
   | `NOT_LIKED_EXCLUDE` | user IDs to leave out of Hasn't liked (comma-separated) |
   | `HIDE_USERS` | user IDs to hide everywhere and not count (comma-separated) |
   | `APP_PASSWORD` | the password people type to open the site |

4. Deploy, open the site and enter the password. The first load downloads the whole history.

After setup, every push to GitHub redeploys the site. Opening the page fetches new messages and updates likes on the newest 100. **Re-sync all** updates likes on older messages. The functions refuse all requests if `APP_PASSWORD` isn't set.

Test locally with `npm install`, then `netlify dev`. It reads `.env`, so also add `APP_PASSWORD=...` there.

## Publish a snapshot to Netlify (drag and drop)

```
python export_static.py
```

This writes `netlify-drop/index.html`: one page with the cached messages built in. Filters, sorting and Hasn't liked all work in the browser. Drag the `netlify-drop` folder onto <https://app.netlify.com/drop>.

- The snapshot has no Refresh button. To update it, click Refresh in the local app, run the export again, and drag the folder onto your site's **Deploys** page.
- The GroupMe token is never included. But **anyone with the site link can read the messages**, so share it carefully.
- `netlify-drop/` is git-ignored so your messages don't end up on GitHub.

## Notes

- GroupMe reports likes as user IDs. They're turned into names using the group's current member list. People who have left the group fall back to the name they last posted under, or to their raw ID if they never posted.
- **Show who hasn't liked** lists current members who didn't like a message. It leaves out the sender, group admins and the owner, and any user IDs listed in `NOT_LIKED_EXCLUDE` in `.env`.
- `HIDE_USERS` in `.env` lists user IDs to hide everywhere. Their likes aren't shown in Liked by or counted in Likes, and they never appear under Hasn't liked.
- The table shows up to 1,000 rows at a time. Use the filters to narrow it down.
- To start over, delete `groupme.db`.
