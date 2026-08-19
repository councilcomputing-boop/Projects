require('dotenv').config();

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const https      = require('https');
const crypto     = require('crypto');
const { URL }    = require('url');
const multer     = require('multer');
const sharp      = require('sharp');
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
      connectSrc:    ["'self'"],
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

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many session refresh attempts. Please sign in again.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset requests. Try again later.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many admin requests. Try again later.' },
  standardHeaders: true, legacyHeaders: false,
  skip: skipForElectron,
});

// ── Multer ────────────────────────────────────────────────────────────────────
// Uploads are held in memory only — never trust the client-supplied mimetype or
// filename/extension for what actually lands on disk (both are attacker-controlled).
// processAndSavePhoto() below decodes and re-encodes every upload with sharp, which
// validates the real image content and produces the on-disk filename itself.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Wraps multer's upload.single('photo') so file-too-large / wrong-mimetype
// rejections come back as a clean JSON 400 instead of Express's default HTML error page.
function uploadPhoto(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Invalid photo upload' });
    next();
  });
}

// Decodes + re-encodes an uploaded image buffer with sharp, which both validates
// that it's genuinely a decodable image (rejecting anything spoofed past the
// mimetype check) and strips any non-image payload since the output bytes are
// freshly generated, never a copy of the input. Always writes a server-chosen
// .jpg filename — never derived from the client-supplied original filename.
async function processAndSavePhoto(buffer) {
  const jpegBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const filename = `profile_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(UPLOADS, filename), jpegBuffer);
  return filename;
}

// ── Web Push (optional — enabled when VAPID env vars are set) ─────────────────
let webpush = null;
try { webpush = require('web-push'); } catch {}
const PUSH_ENABLED = !!(webpush && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (PUSH_ENABLED) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
} else {
  console.warn('[WARN]  Web push disabled — set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable reminders.');
}

// ── Transactional email (optional — enabled when RESEND_API_KEY is set) ───────
// Used only for password-reset links. Without a key configured, the reset link
// is logged to the server console instead — lets reset work in dev/Electron
// without any email account, at the cost of not actually reaching the user.
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const RESET_EMAIL_FROM = process.env.RESET_EMAIL_FROM || 'Prayer Profiles <onboarding@resend.dev>';
const APP_ORIGIN       = process.env.APP_ORIGIN || `http://localhost:${process.env.PORT || 3001}`;
const EMAIL_ENABLED    = !!RESEND_API_KEY;
if (!EMAIL_ENABLED) {
  console.warn('[WARN]  Email sending disabled — set RESEND_API_KEY to actually deliver password-reset links.');
}

function sendResetEmail(toEmail, resetLink) {
  return new Promise((resolve) => {
    const html = `<p>Someone requested a password reset for your Prayer Profiles account.</p>
<p><a href="${resetLink}">Click here to choose a new password</a>. This link expires in 15 minutes.</p>
<p>If you didn't request this, you can safely ignore this email.</p>`;

    if (!EMAIL_ENABLED) {
      console.log(`[reset] Email sending is not configured. Reset link for ${toEmail}: ${resetLink}`);
      return resolve();
    }

    const body = JSON.stringify({
      from:    RESET_EMAIL_FROM,
      to:      [toEmail],
      subject: 'Reset your Prayer Profiles password',
      html,
    });
    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', (err) => {
      console.error('[reset] Failed to send reset email:', err.message);
      resolve();
    });
    req.write(body);
    req.end();
  });
}

// ── JSON storage ──────────────────────────────────────────────────────────────
function readDB() {
  let db;
  if (!fs.existsSync(DB_FILE)) {
    db = { users: [], profiles: [], prayer_log: [], nextId: 1 };
  } else {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch { db = { users: [], profiles: [], prayer_log: [], nextId: 1 }; }
  }
  if (!db.prayer_log)     db.prayer_log     = [];
  if (!db.reminders)      db.reminders      = [];
  if (!db.push_subs)      db.push_subs      = [];
  if (!db.metrics)        db.metrics        = {};
  if (!db.refreshTokens)  db.refreshTokens  = [];
  if (!db.resetTokens)    db.resetTokens    = [];
  return db;
}

// Aggregate, anonymous usage counters — daily counts only, never content or user ids
function bumpMetric(db, key, n = 1) {
  const day = new Date().toISOString().split('T')[0];
  if (!db.metrics[day]) db.metrics[day] = {};
  db.metrics[day][key] = (db.metrics[day][key] || 0) + n;
}
function writeDB(data) {
  // Write to a temp file then rename over the real one — rename is atomic on the
  // same filesystem, so a crash/kill mid-write can never leave profiles.json truncated.
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
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

// ── Tokens ────────────────────────────────────────────────────────────────────
// Access tokens are short-lived JWTs (stateless, can't be revoked early).
// Refresh tokens are long-lived, opaque, random, and tracked server-side by
// hash only — this is what actually gives us revocation (logout, "sign out
// everywhere") that a bare JWT can never provide on its own.
const ACCESS_TOKEN_TTL     = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signAccessToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function pruneExpiredRefreshTokens(db) {
  const now = Date.now();
  db.refreshTokens = db.refreshTokens.filter(rt => rt.expiresAt > now);
}

// Issues a new refresh token for a user and stores only its hash — the raw
// token is returned once and never persisted, so a leaked DB alone can't be
// replayed as a live session.
function issueRefreshToken(db, userId) {
  pruneExpiredRefreshTokens(db);
  const raw = crypto.randomBytes(48).toString('hex');
  db.refreshTokens.push({ userId, tokenHash: hashRefreshToken(raw), createdAt: Date.now(), expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS });
  return raw;
}

// Invalidates every refresh token for a user — used on logout-everywhere and
// on password reset, so a changed/reset password also kills existing sessions.
function revokeAllRefreshTokens(db, userId) {
  db.refreshTokens = db.refreshTokens.filter(rt => rt.userId !== userId);
}

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes, single-use

function pruneExpiredResetTokens(db) {
  const now = Date.now();
  db.resetTokens = db.resetTokens.filter(rt => rt.expiresAt > now);
}

// Issues a single-use password-reset token for a user, storing only its hash
// (same reasoning as refresh tokens — the raw value is emailed once, never persisted).
function issueResetToken(db, userId) {
  pruneExpiredResetTokens(db);
  db.resetTokens = db.resetTokens.filter(rt => rt.userId !== userId); // one live reset token per user
  const raw = crypto.randomBytes(32).toString('hex');
  db.resetTokens.push({ userId, tokenHash: hashRefreshToken(raw), expiresAt: Date.now() + RESET_TOKEN_TTL_MS });
  return raw;
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '512kb' }));
app.use(apiLimiter);
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth routes ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/auth/register', registerLimiter, async (req, res) => {
  const { password, inviteCode } = req.body;
  const username = (req.body.username || '').trim();
  const email    = (req.body.email    || '').trim().toLowerCase();

  if (!username || !password || !email)
    return res.status(400).json({ error: 'Username, email, and password are required' });
  if (username.length > 32)
    return res.status(400).json({ error: 'Username must be 32 characters or fewer' });
  if (!/^[a-zA-Z0-9_.\-]+$/.test(username))
    return res.status(400).json({ error: 'Username may only contain letters, numbers, _ . -' });
  if (email.length > 200 || !EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Enter a valid email address' });
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
  if (db.users.find(u => (u.email || '').toLowerCase() === email))
    return res.status(409).json({ error: 'An account with that email already exists' });

  const user = {
    id:         db.nextId++,
    username,
    email,
    password:   await bcrypt.hash(password, 12),
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  const refreshToken = issueRefreshToken(db, user.id);
  writeDB(db);

  res.json({ token: signAccessToken(user), refreshToken, username: user.username });
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

  bumpMetric(db, 'logins');
  const refreshToken = issueRefreshToken(db, user.id);
  writeDB(db);

  res.json({ token: signAccessToken(user), refreshToken, username: user.username });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// Lets a user download everything stored under their account as a single JSON
// file — account info aside, never includes another user's data or anyone
// else's password hash.
app.get('/api/export', requireAuth, (req, res) => {
  const db = readDB();
  const user = (db.users || []).find(u => u.id === req.user.id);
  const exportData = {
    exported_at: new Date().toISOString(),
    account:     user ? { id: user.id, username: user.username, email: user.email || null, created_at: user.created_at } : null,
    profiles:    (db.profiles    || []).filter(p => p.userId === req.user.id),
    prayer_log:  (db.prayer_log  || []).filter(e => e.userId === req.user.id),
    reminders:   (db.reminders   || []).filter(r => r.userId === req.user.id),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="prayer-profiles-export.json"');
  res.json(exportData);
});

// Exchanges a still-valid refresh token for a new access token, and rotates
// the refresh token itself (old one is invalidated, a new one is issued) —
// rotation means a stolen-and-replayed refresh token gets detected/cut off
// the next time the legitimate client tries to use its now-superseded copy.
app.post('/api/auth/refresh', refreshLimiter, (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || typeof refreshToken !== 'string')
    return res.status(401).json({ error: 'Session expired — please sign in again' });

  const db   = readDB();
  pruneExpiredRefreshTokens(db);
  const hash   = hashRefreshToken(refreshToken);
  const record = db.refreshTokens.find(rt => rt.tokenHash === hash);
  if (!record) return res.status(401).json({ error: 'Session expired — please sign in again' });

  const user = (db.users || []).find(u => u.id === record.userId);
  if (!user) return res.status(401).json({ error: 'Session expired — please sign in again' });

  db.refreshTokens = db.refreshTokens.filter(rt => rt.tokenHash !== hash);
  const newRefreshToken = issueRefreshToken(db, user.id);
  writeDB(db);

  res.json({ token: signAccessToken(user), refreshToken: newRefreshToken, username: user.username });
});

// Revokes a single refresh token (this device/session only). Doesn't require
// a valid access token, since the whole point is to work even after it's expired.
app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken && typeof refreshToken === 'string') {
    const db   = readDB();
    const hash = hashRefreshToken(refreshToken);
    if (db.refreshTokens.some(rt => rt.tokenHash === hash)) {
      db.refreshTokens = db.refreshTokens.filter(rt => rt.tokenHash !== hash);
      writeDB(db);
    }
  }
  res.status(204).end();
});

// Always responds with the same generic message whether or not the email is
// registered — otherwise this endpoint would let anyone check which emails
// have accounts.
app.post('/api/auth/request-reset', resetLimiter, async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const genericMessage = { message: 'If an account exists for that email, a reset link has been sent.' };
  if (!email || !EMAIL_RE.test(email)) return res.json(genericMessage);

  const db   = readDB();
  const user = (db.users || []).find(u => (u.email || '').toLowerCase() === email);
  if (user) {
    const resetToken = issueResetToken(db, user.id);
    writeDB(db);
    const resetLink = `${APP_ORIGIN}/reset.html?token=${resetToken}`;
    await sendResetEmail(user.email, resetLink);
  }
  res.json(genericMessage);
});

app.post('/api/auth/reset-password', resetLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string')
    return res.status(400).json({ error: 'Invalid or expired reset link' });
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (newPassword.length > 72)
    return res.status(400).json({ error: 'Password is too long (max 72 characters)' });

  const db = readDB();
  pruneExpiredResetTokens(db);
  const hash   = hashRefreshToken(token);
  const record = db.resetTokens.find(rt => rt.tokenHash === hash);
  if (!record) return res.status(400).json({ error: 'Invalid or expired reset link' });

  const user = (db.users || []).find(u => u.id === record.userId);
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

  user.password   = await bcrypt.hash(newPassword, 12);
  db.resetTokens  = db.resetTokens.filter(rt => rt.tokenHash !== hash);
  revokeAllRefreshTokens(db, user.id); // resetting the password signs out every existing session
  writeDB(db);

  res.json({ message: 'Password updated — you can now sign in.' });
});

// ── Birthday parsing (free-text field → month/day) ───────────────────────────
const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function parseBirthdayMD(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  let m;
  // 1990-05-15 or 05-15 / 05/15
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)))  return checkMD(+m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/))) return checkMD(+m[1], +m[2]);
  // "May 15" / "May 15, 1990" / "15 May"
  if ((m = s.match(/^([a-z]+)\.?\s+(\d{1,2})/)))  { const mi = MONTH_NAMES.indexOf(m[1].slice(0,3)); if (mi !== -1) return checkMD(mi + 1, +m[2]); }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]+)/)))     { const mi = MONTH_NAMES.indexOf(m[2].slice(0,3)); if (mi !== -1) return checkMD(mi + 1, +m[1]); }
  return null;
}
function checkMD(month, day) {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 ? { month, day } : null;
}

// Auto-create/update/remove the birthday reminder for a profile (unified reminder model)
function syncBirthdayReminder(db, profile) {
  const idx = db.reminders.findIndex(r => r.type === 'birthday' && r.profileId === profile.id);
  const md  = parseBirthdayMD(profile.birthday);
  if (md) {
    if (idx === -1) {
      db.reminders.push({
        id: db.nextId++, userId: profile.userId, type: 'birthday',
        profileId: profile.id, group: null, days: null, time: '09:00',
        tz: null, enabled: true, last_fired: null,
        created_at: new Date().toISOString(),
      });
    }
  } else if (idx !== -1) {
    db.reminders.splice(idx, 1);
  }
}

// ── Profiles ──────────────────────────────────────────────────────────────────
app.get('/api/profiles', requireAuth, (req, res) => {
  res.json(readDB().profiles.filter(p => p.userId === req.user.id));
});

app.post('/api/profiles', requireAuth, uploadPhoto, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long (max 100 characters)' });

  let photo_url = null;
  if (req.file) {
    try {
      photo_url = '/uploads/' + await processAndSavePhoto(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'That file could not be read as an image' });
    }
  }

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
    photo_url,
    last_prayed_date: null,
    last_prayed_at:   null,
    prayer_notes:     [],
    verses:           [],
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };
  db.profiles.push(profile);
  syncBirthdayReminder(db, profile);
  writeDB(db);
  res.status(201).json(profile);
});

app.put('/api/profiles/:id', requireAuth, uploadPhoto, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long' });

  const db  = readDB();
  const idx = db.profiles.findIndex(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const prev      = db.profiles[idx];
  let   photo_url = prev.photo_url;
  if (req.file) {
    let newFilename;
    try {
      newFilename = await processAndSavePhoto(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'That file could not be read as an image' });
    }
    deletePhoto(prev.photo_url);
    photo_url = '/uploads/' + newFilename;
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
  syncBirthdayReminder(db, db.profiles[idx]);
  writeDB(db);
  res.json(db.profiles[idx]);
});

app.delete('/api/profiles/:id', requireAuth, (req, res) => {
  const db      = readDB();
  const profile = db.profiles.find(p => p.id === Number(req.params.id) && p.userId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Not found' });
  deletePhoto(profile.photo_url);
  db.profiles  = db.profiles.filter(p => p.id !== Number(req.params.id));
  // Cascade: reminders pointing at this profile must not outlive it
  db.reminders = db.reminders.filter(r => r.profileId !== profile.id);
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
  profile.last_prayed_at   = wasUnprayed ? new Date().toISOString() : null;
  profile.updated_at       = new Date().toISOString();
  // Upsert into prayer_log when marking as prayed (not when un-marking)
  if (wasUnprayed && !db.prayer_log.find(e => e.userId === req.user.id && e.date === today)) {
    db.prayer_log.push({ userId: req.user.id, date: today });
  }
  if (wasUnprayed) bumpMetric(db, 'prayed_marks');
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
    id:            db.nextId++,
    text,
    date:          req.body.date || new Date().toISOString().split('T')[0],
    answered:      false,
    answered_at:   null,
    answered_note: '',
    created_at:    new Date().toISOString(),
  };
  profile.prayer_notes.push(prayer);
  bumpMetric(db, 'prayers_added');
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
  const next = {
    ...prev,
    ...(req.body.text     !== undefined ? { text:     req.body.text.trim().slice(0, 2000) } : {}),
    ...(req.body.date     !== undefined ? { date:     req.body.date                       } : {}),
    ...(req.body.answered !== undefined ? { answered: Boolean(req.body.answered)           } : {}),
  };
  // Answered transitions: stamp date/time + optional "how it was answered" note
  if (!prev.answered && next.answered) {
    next.answered_at   = new Date().toISOString();
    next.answered_note = (req.body.answered_note || '').trim().slice(0, 2000);
    bumpMetric(db, 'prayers_answered');
  } else if (prev.answered && !next.answered) {
    next.answered_at   = null;
    next.answered_note = '';
  }
  profile.prayer_notes[pIdx] = next;
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
  bumpMetric(db, 'verses_added');
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

// ── Reminders (unified model: profile | group | birthday) ────────────────────
const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function validTZ(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}
function saveUserTZ(db, userId, tz) {
  if (!validTZ(tz)) return;
  const user = db.users.find(u => u.id === userId);
  if (user) user.tz = tz;
}

app.get('/api/reminders', requireAuth, (req, res) => {
  res.json(readDB().reminders.filter(r => r.userId === req.user.id));
});

app.post('/api/reminders', requireAuth, (req, res) => {
  const { type, profileId, group, days, time, tz } = req.body;
  if (type !== 'profile' && type !== 'group')
    return res.status(400).json({ error: 'Type must be "profile" or "group" (birthday reminders are created automatically)' });
  if (!Array.isArray(days) || !days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6))
    return res.status(400).json({ error: 'Days must be a list of weekdays (0=Sun … 6=Sat)' });
  if (!VALID_TIME.test(time || ''))
    return res.status(400).json({ error: 'Time must be HH:MM (24h)' });

  const db = readDB();
  if (type === 'profile') {
    const p = db.profiles.find(p => p.id === Number(profileId) && p.userId === req.user.id);
    if (!p) return res.status(404).json({ error: 'Profile not found' });
  } else {
    const g = (group || '').trim().slice(0, 50);
    if (!g) return res.status(400).json({ error: 'Group name is required' });
    if (!db.profiles.some(p => p.userId === req.user.id && p.relationship === g))
      return res.status(404).json({ error: 'No profiles in that group' });
  }

  const reminder = {
    id:         db.nextId++,
    userId:     req.user.id,
    type,
    profileId:  type === 'profile' ? Number(profileId) : null,
    group:      type === 'group' ? (group || '').trim().slice(0, 50) : null,
    days:       [...new Set(days)].sort(),
    time,
    tz:         validTZ(tz) ? tz : null,
    enabled:    true,
    last_fired: null,
    created_at: new Date().toISOString(),
  };
  db.reminders.push(reminder);
  saveUserTZ(db, req.user.id, tz);
  writeDB(db);
  res.status(201).json(reminder);
});

app.put('/api/reminders/:id', requireAuth, (req, res) => {
  const db = readDB();
  const r  = db.reminders.find(r => r.id === Number(req.params.id) && r.userId === req.user.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.body.days !== undefined) {
    if (!Array.isArray(req.body.days) || !req.body.days.length || req.body.days.some(d => !Number.isInteger(d) || d < 0 || d > 6))
      return res.status(400).json({ error: 'Invalid days' });
    r.days = [...new Set(req.body.days)].sort();
  }
  if (req.body.time !== undefined) {
    if (!VALID_TIME.test(req.body.time)) return res.status(400).json({ error: 'Invalid time' });
    r.time = req.body.time;
  }
  if (req.body.enabled !== undefined) r.enabled = Boolean(req.body.enabled);
  if (req.body.tz      !== undefined && validTZ(req.body.tz)) r.tz = req.body.tz;
  writeDB(db);
  res.json(r);
});

app.delete('/api/reminders/:id', requireAuth, (req, res) => {
  const db  = readDB();
  const len = db.reminders.length;
  db.reminders = db.reminders.filter(r => !(r.id === Number(req.params.id) && r.userId === req.user.id));
  if (db.reminders.length === len) return res.status(404).json({ error: 'Not found' });
  writeDB(db);
  res.json({ success: true });
});

// ── Push subscriptions ────────────────────────────────────────────────────────
app.get('/api/push/public-key', (req, res) => {
  res.json({ enabled: PUSH_ENABLED, key: PUSH_ENABLED ? process.env.VAPID_PUBLIC_KEY : null });
});

app.post('/api/push/subscribe', requireAuth, (req, res) => {
  const sub = req.body.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('https://'))
    return res.status(400).json({ error: 'Invalid subscription' });
  const db = readDB();
  db.push_subs = db.push_subs.filter(s => s.subscription.endpoint !== sub.endpoint);
  db.push_subs.push({ userId: req.user.id, subscription: sub, created_at: new Date().toISOString() });
  saveUserTZ(db, req.user.id, req.body.tz);
  writeDB(db);
  res.status(201).json({ success: true });
});

app.post('/api/push/unsubscribe', requireAuth, (req, res) => {
  const db = readDB();
  db.push_subs = db.push_subs.filter(s => !(s.userId === req.user.id && s.subscription.endpoint === req.body.endpoint));
  writeDB(db);
  res.json({ success: true });
});

async function sendPushToUser(db, userId, payload) {
  if (!PUSH_ENABLED) return false;
  const subs = db.push_subs.filter(s => s.userId === userId);
  const dead = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(s.subscription.endpoint);
    }
  }
  if (dead.length) db.push_subs = db.push_subs.filter(s => !dead.includes(s.subscription.endpoint));
  return dead.length > 0;
}

// ── Reminder scheduler (runs every minute; times evaluated in each reminder's TZ)
function nowInTZ(tz) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, hour12: false, weekday: 'short',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }).formatToParts(new Date()).map(p => [p.type, p.value])
    );
    const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const hour   = parts.hour === '24' ? '00' : parts.hour; // some ICU versions emit 24:00
    return {
      date:  `${parts.year}-${parts.month}-${parts.day}`,
      hhmm:  `${hour}:${parts.minute}`,
      dow:   dowMap[parts.weekday.slice(0, 3)],
      month: Number(parts.month),
      day:   Number(parts.day),
    };
  } catch { return null; }
}

async function reminderTick() {
  const db  = readDB();
  let dirty = false;
  const tzNow = {};
  const due   = [];

  for (const r of db.reminders) {
    if (!r.enabled) continue;
    const user = db.users.find(u => u.id === r.userId);
    const tz   = r.tz || (user && user.tz) || 'UTC';
    if (!(tz in tzNow)) tzNow[tz] = nowInTZ(tz) || nowInTZ('UTC');
    const now = tzNow[tz];
    const fireKey = `${now.date} ${now.hhmm}`;
    if (r.last_fired === fireKey || r.time !== now.hhmm) continue;

    if (r.type === 'birthday' || r.type === 'profile') {
      const p = db.profiles.find(p => p.id === r.profileId && p.userId === r.userId);
      if (!p) { r._orphan = true; dirty = true; continue; } // profile deleted → prune below
      if (r.type === 'birthday') {
        const md = parseBirthdayMD(p.birthday);
        if (!md || md.month !== now.month || md.day !== now.day) continue;
        due.push({ r, fireKey, payload: {
          title: 'Birthday today 🎂',
          body:  `It's ${p.name}'s birthday — say a prayer for them!`,
          url:   `/?profile=${p.id}`,
        }});
      } else {
        if (!r.days.includes(now.dow)) continue;
        due.push({ r, fireKey, payload: {
          title: 'Prayer reminder',
          body:  `Time to pray for ${p.name}`,
          url:   `/?profile=${p.id}`,
        }});
      }
    } else if (r.type === 'group') {
      if (!r.days.includes(now.dow)) continue;
      const members = db.profiles.filter(p => p.userId === r.userId && p.relationship === r.group);
      if (!members.length) continue; // group currently empty/renamed — skip, don't crash or prune
      // Only call out people not yet prayed for today — if the group is already covered, stay quiet
      const unprayed = members.filter(p => p.last_prayed_date !== now.date);
      if (!unprayed.length) continue;
      const names = unprayed.slice(0, 3).map(p => p.name);
      const body = unprayed.length <= 3
        ? `${names.join(', ')} (${r.group}) ${unprayed.length === 1 ? 'hasn’t' : 'haven’t'} been prayed for yet today.`
        : `${names.join(', ')} and ${unprayed.length - 3} more in ${r.group} haven’t been prayed for yet today.`;
      due.push({ r, fireKey, payload: {
        title: 'Prayer reminder',
        body,
        url:   `/?group=${encodeURIComponent(r.group)}`,
      }});
    }
  }

  if (db.reminders.some(r => r._orphan)) {
    db.reminders = db.reminders.filter(r => !r._orphan);
  }

  for (const { r, fireKey, payload } of due) {
    r.last_fired = fireKey;
    dirty = true;
    await sendPushToUser(db, r.userId, payload);
  }
  if (dirty) writeDB(db);
}

if (PUSH_ENABLED) setInterval(() => reminderTick().catch(err => console.error('[reminders]', err.message)), 60 * 1000);

// Constant-time string compare — a plain `!==` leaks timing information about
// how many leading characters matched, which is avoidable for free here.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ── Admin metrics (aggregate + anonymous — reporting only) ────────────────────
app.get('/api/admin/metrics', adminLimiter, (req, res) => {
  const key = process.env.ADMIN_KEY;
  if (!key) return res.status(503).json({ error: 'ADMIN_KEY is not configured' });
  if (!safeEqual(req.headers['x-admin-key'] || '', key)) return res.status(401).json({ error: 'Unauthorized' });

  const db     = readDB();
  const totals = {};
  for (const day of Object.keys(db.metrics)) {
    for (const [k, v] of Object.entries(db.metrics[day])) totals[k] = (totals[k] || 0) + v;
  }
  // Aggregate counts only — no usernames, no prayer/verse content
  res.json({
    days:   db.metrics,
    totals,
    snapshot: {
      users:              db.users.length,
      profiles:           db.profiles.length,
      reminders:          db.reminders.length,
      push_subscriptions: db.push_subs.length,
    },
  });
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
