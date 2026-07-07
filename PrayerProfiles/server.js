require('dotenv').config();

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const https      = require('https');
const { URL }    = require('url');
const multer     = require('multer');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

// ── Environment & secrets ─────────────────────────────────────────────────────
const IS_ELECTRON = process.env.ELECTRON_APP === '1';
const JWT_SECRET  = process.env.JWT_SECRET;
const INVITE_CODE = process.env.INVITE_CODE;

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. Generate one:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}
if (!IS_ELECTRON && !INVITE_CODE) {
  console.warn('[WARN]  INVITE_CODE is not set — registration is open to anyone who reaches this server.');
}

const PORT     = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE  = path.join(DATA_DIR, 'profiles.json');
const UPLOADS  = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();

// Trust Fly.io's proxy so express-rate-limit can read X-Forwarded-For correctly
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:    ["'self'"],
      scriptSrc:     ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:      ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:       ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:        ["'self'", 'data:', 'blob:'],
      connectSrc:    ["'self'", 'https://bible-api.com'],
      workerSrc:     ["'self'"],
      frameAncestors:["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const skipForElectron = () => IS_ELECTRON;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Account creation limit reached. Try again later.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

const icloudLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { error: 'Too many iCloud sync attempts. Wait 5 minutes.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

// ── Multer ────────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ── JSON storage ──────────────────────────────────────────────────────────────
function readDB() {
  let db;
  if (!fs.existsSync(DB_FILE)) {
    db = { users: [], profiles: [], prayer_log: [], nextId: 1 };
  } else {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { db = { users: [], profiles: [], prayer_log: [], nextId: 1 }; }
  }
  if (!db.prayer_log) db.prayer_log = [];
  return db;
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function deletePhoto(photoUrl) {
  if (!photoUrl) return;
  try {
    // Use basename only — prevents any path traversal via stored URL
    const basename = path.basename(photoUrl);
    const fp = path.join(UPLOADS, basename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch {}
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth  = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please sign in again' });
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(apiLimiter);
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post('/api/auth/register', registerLimiter, async (req, res) => {
  const { password, inviteCode } = req.body;
  const username = (req.body.username || '').trim();

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });
  if (username.length > 32)
    return res.status(400).json({ error: 'Username must be 32 characters or fewer' });
  if (!/^[a-zA-Z0-9_.\-]+$/.test(username))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _ . -' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password.length > 72)
    return res.status(400).json({ error: 'Password is too long (max 72 characters)' });

  if (!IS_ELECTRON && INVITE_CODE && inviteCode !== INVITE_CODE)
    return res.status(403).json({ error: 'Invalid invite code' });

  const db = readDB();
  if (!db.users) db.users = [];
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ error: 'Username already taken' });

  const user = {
    id:         db.nextId++,
    username,
    password:   await bcrypt.hash(password, 12),
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { password } = req.body;
  const username = (req.body.username || '').trim();

  if (!username || !password)
    return res.status(400).json({ error: 'Username and password are required' });

  const db   = readDB();
  const user = (db.users || []).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid username or password' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// ── Profiles ──────────────────────────────────────────────────────────────────
app.get('/api/profiles', requireAuth, (req, res) => {
  res.json(readDB().profiles.filter(p => p.userId === req.user.id));
});

app.post('/api/profiles', requireAuth, upload.single('photo'), (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    if (req.file) deletePhoto('/uploads/' + req.file.filename);
    return res.status(400).json({ error: 'Name is required' });
  }
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long (max 100 characters)' });

  const db      = readDB();
  const profile = {
    id:               db.nextId++,
    userId:           req.user.id,
    name,
    relationship:     (req.body.relationship || '').trim().slice(0, 50),
    phone:            (req.body.phone        || '').trim().slice(0, 30),
    email:            (req.body.email        || '').trim().slice(0, 200),
    birthday:         (req.body.birthday     || '').trim().slice(0, 30),
    notes:            (req.body.notes        || '').trim().slice(0, 5000),
    photo_url:        req.file ? '/uploads/' + req.file.filename : null,
    last_prayed_date: null,
    prayer_notes:     [],
    verses:           [],
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };
  db.profiles.push(profile);
  writeDB(db);
  res.status(201).json(profile);
});

app.put('/api/profiles/:id', requireAuth, upload.single('photo'), (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    if (req.file) deletePhoto('/uploads/' + req.file.filename);
    return res.status(400).json({ error: 'Name is required' });
  }
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long' });

  const db  = readDB();
  const idx = db.profiles.findIndex(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (idx === -1) {
    if (req.file) deletePhoto('/uploads/' + req.file.filename);
    return res.status(404).json({ error: 'Not found' });
  }
  const prev      = db.profiles[idx];
  let   photo_url = prev.photo_url;
  if (req.file) {
    deletePhoto(prev.photo_url);
    photo_url = '/uploads/' + req.file.filename;
  } else if (req.body.remove_photo === 'true') {
    deletePhoto(prev.photo_url);
    photo_url = null;
  }
  db.profiles[idx] = {
    ...prev,
    name,
    relationship: (req.body.relationship || '').trim().slice(0, 50),
    phone:        (req.body.phone        || '').trim().slice(0, 30),
    email:        (req.body.email        || '').trim().slice(0, 200),
    birthday:     (req.body.birthday     || '').trim().slice(0, 30),
    notes:        (req.body.notes        || '').trim().slice(0, 5000),
    photo_url,
    updated_at: new Date().toISOString(),
  };
  writeDB(db);
  res.json(db.profiles[idx]);
});

app.delete('/api/profiles/:id', requireAuth, (req, res) => {
  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Not found' });
  deletePhoto(profile.photo_url);
  db.profiles = db.profiles.filter(p => p.id !== Number(req.params.id));
  writeDB(db);
  res.json({ success: true });
});

// ── Pray Today ────────────────────────────────────────────────────────────────
app.put('/api/profiles/:id/pray', requireAuth, (req, res) => {
  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Not found' });
  const today       = new Date().toISOString().split('T')[0];
  const wasUnprayed = profile.last_prayed_date !== today;
  profile.last_prayed_date = wasUnprayed ? today : null;
  profile.updated_at       = new Date().toISOString();
  // Upsert into prayer_log when marking as prayed (not when un-marking)
  if (wasUnprayed && !db.prayer_log.find(e => e.userId === req.user.id && e.date === today)) {
    db.prayer_log.push({ userId: req.user.id, date: today });
  }
  writeDB(db);
  res.json(profile);
});

// ── Prayer Log ────────────────────────────────────────────────────────────────
app.get('/api/prayer-log', requireAuth, (req, res) => {
  const db = readDB();
  res.json((db.prayer_log || []).filter(e => e.userId === req.user.id));
});

// ── Prayer Notes ──────────────────────────────────────────────────────────────
app.post('/api/profiles/:id/prayers', requireAuth, (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Prayer text is required' });
  if (text.length > 2000) return res.status(400).json({ error: 'Prayer note is too long (max 2000 characters)' });

  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const prayer = {
    id:         db.nextId++,
    text,
    date:       req.body.date || new Date().toISOString().split('T')[0],
    answered:   false,
    created_at: new Date().toISOString(),
  };
  profile.prayer_notes.push(prayer);
  writeDB(db);
  res.status(201).json(prayer);
});

app.put('/api/profiles/:id/prayers/:pid', requireAuth, (req, res) => {
  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const pIdx = profile.prayer_notes.findIndex(p => p.id === Number(req.params.pid));
  if (pIdx === -1) return res.status(404).json({ error: 'Prayer not found' });
  const prev = profile.prayer_notes[pIdx];
  profile.prayer_notes[pIdx] = {
    ...prev,
    ...(req.body.text     !== undefined ? { text:     req.body.text.trim().slice(0, 2000) } : {}),
    ...(req.body.date     !== undefined ? { date:     req.body.date                       } : {}),
    ...(req.body.answered !== undefined ? { answered: Boolean(req.body.answered)           } : {}),
  };
  writeDB(db);
  res.json(profile.prayer_notes[pIdx]);
});

app.delete('/api/profiles/:id/prayers/:pid', requireAuth, (req, res) => {
  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const len = profile.prayer_notes.length;
  profile.prayer_notes = profile.prayer_notes.filter(p => p.id !== Number(req.params.pid));
  if (profile.prayer_notes.length === len) return res.status(404).json({ error: 'Not found' });
  writeDB(db);
  res.json({ success: true });
});

// ── Bible Verses ──────────────────────────────────────────────────────────────
app.post('/api/profiles/:id/verses', requireAuth, (req, res) => {
  const reference = (req.body.reference || '').trim();
  if (!reference) return res.status(400).json({ error: 'Reference is required' });
  if (reference.length > 100) return res.status(400).json({ error: 'Reference is too long' });

  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const verse = {
    id:        db.nextId++,
    reference,
    text:      (req.body.text || '').trim().slice(0, 2000),
    added_at:  new Date().toISOString(),
  };
  profile.verses.push(verse);
  writeDB(db);
  res.status(201).json(verse);
});

app.delete('/api/profiles/:id/verses/:vid', requireAuth, (req, res) => {
  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const len = profile.verses.length;
  profile.verses = profile.verses.filter(v => v.id !== Number(req.params.vid));
  if (profile.verses.length === len) return res.status(404).json({ error: 'Not found' });
  writeDB(db);
  res.json({ success: true });
});

// ── iCloud CardDAV ────────────────────────────────────────────────────────────
function carddavReq({ method, host, path: reqPath, headers = {}, body = '' }) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf-8');
    const req = https.request(
      { method, hostname: host, path: reqPath, headers: { ...headers, 'Content-Length': buf.length } },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }));
      }
    );
    req.on('error', reject);
    if (buf.length) req.write(buf);
    req.end();
  });
}

async function carddavFollow(opts, maxHops = 6) {
  let cur = { ...opts };
  for (let i = 0; i < maxHops; i++) {
    const r = await carddavReq(cur);
    if ([301, 302, 307].includes(r.status) && r.headers.location) {
      const loc = new URL(r.headers.location, `https://${cur.host}${cur.path}`);
      cur = { ...cur, host: loc.hostname, path: loc.pathname + (loc.search || '') };
    } else {
      return { ...r, finalHost: cur.host, finalPath: cur.path };
    }
  }
  throw new Error('Too many redirects from iCloud');
}

function xmlTag(xml, tag) {
  const re = new RegExp(`<[^>]*:?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/[^>]*:?${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}
function xmlHref(block) {
  const m = block.match(/<[^>]*:?href[^>]*>([^<]+)<\/[^>]*:?href>/i);
  return m ? m[1].trim() : '';
}

async function doICloudFetch(appleId, appPassword) {
  const auth = `Basic ${Buffer.from(`${appleId}:${appPassword}`).toString('base64')}`;
  const hdrs = {
    Authorization: auth,
    'Content-Type': 'application/xml; charset=utf-8',
    Accept: 'text/xml, application/xml',
    'User-Agent': 'PrayerProfiles/1.0',
  };

  const disc = await carddavFollow({
    method: 'PROPFIND',
    host: 'contacts.icloud.com',
    path: '/.well-known/carddav',
    headers: { ...hdrs, Depth: '0' },
    body: `<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`,
  });
  if (disc.status === 401) throw new Error('Invalid Apple ID or app-specific password. Make sure you use an app-specific password (not your regular Apple ID password).');
  if (disc.status !== 207) throw new Error(`iCloud returned status ${disc.status}. Check your credentials and try again.`);

  let principalPath = '';
  for (const b of xmlTag(disc.body, 'current-user-principal')) {
    const h = xmlHref(b);
    if (h) { principalPath = h; break; }
  }
  if (!principalPath) throw new Error('Could not find your iCloud principal. Verify your Apple ID.');

  const icloudHost = disc.finalHost;

  const homeResp = await carddavReq({
    method: 'PROPFIND', host: icloudHost, path: principalPath,
    headers: { ...hdrs, Depth: '0' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop><C:addressbook-home-set/></D:prop>
</D:propfind>`,
  });
  let homePath = '';
  for (const b of xmlTag(homeResp.body, 'addressbook-home-set')) {
    const h = xmlHref(b);
    if (h) { homePath = h; break; }
  }
  if (!homePath) throw new Error('Could not find your iCloud address book.');

  const listResp = await carddavReq({
    method: 'PROPFIND', host: icloudHost, path: homePath,
    headers: { ...hdrs, Depth: '1' },
    body: `<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>`,
  });
  let abPath = '';
  for (const block of xmlTag(listResp.body, 'response')) {
    const href = xmlHref(block);
    if (href && href !== homePath && /addressbook/i.test(block)) { abPath = href; break; }
  }
  if (!abPath) abPath = homePath;

  const report = await carddavReq({
    method: 'REPORT', host: icloudHost, path: abPath,
    headers: { ...hdrs, Depth: '1' },
    body: `<?xml version="1.0" encoding="utf-8"?>
<C:addressbook-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav">
  <D:prop><D:getetag/><C:address-data/></D:prop>
  <C:filter/>
</C:addressbook-query>`,
  });

  const contacts = [];
  for (const raw of xmlTag(report.body, 'address-data')) {
    const decoded = raw.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
    const c = parseVcardSimple(decoded);
    if (c.name) contacts.push(c);
  }
  contacts.sort((a, b) => a.name.localeCompare(b.name));
  return contacts;
}

function parseVcardSimple(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const c = { name: '', phone: '', email: '', birthday: '' };
  for (const line of lines) {
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const prop = line.substring(0, ci).toUpperCase().split(';')[0];
    let val = line.substring(ci + 1).trim();
    switch (prop) {
      case 'FN':    if (!c.name)     c.name     = val.replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\\/g,'').trim(); break;
      case 'TEL':   if (!c.phone)    c.phone    = val.replace(/[^\d+\-() ]/g,'').trim(); break;
      case 'EMAIL': if (!c.email)    c.email    = val.trim(); break;
      case 'BDAY':  if (!c.birthday) c.birthday = parseBdaySrv(val); break;
    }
  }
  return c;
}
function parseBdaySrv(val) {
  val = val.trim();
  if (val.startsWith('--')) {
    const md = val.replace(/^--/,'').replace('-','');
    if (md.length >= 4) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const m = parseInt(md.substring(0,2),10) - 1;
      const d = parseInt(md.substring(2,4),10);
      if (m >= 0 && m < 12) return `${months[m]} ${d}`;
    }
    return val;
  }
  const digits = val.replace(/\D/g,'');
  if (digits.length === 8) return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
  return val;
}

app.post('/api/icloud/contacts', requireAuth, icloudLimiter, async (req, res) => {
  const { appleId, appPassword } = req.body || {};
  if (!appleId || !appPassword)
    return res.status(400).json({ error: 'Apple ID and app-specific password are required.' });
  if (typeof appleId !== 'string' || appleId.length > 200)
    return res.status(400).json({ error: 'Invalid Apple ID.' });
  try {
    const contacts = await doICloudFetch(appleId.trim(), appPassword.trim());
    res.json({ contacts });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to fetch iCloud contacts.' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`Prayer Profiles running at http://localhost:${PORT}`));
