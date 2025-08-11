// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { pool } = require('./Database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Config sesión
const COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,                // local: false, prod: true
  sameSite: isProd ? 'none' : 'lax',
  path: '/',
  maxAge: 2 * 60 * 60 * 1000     // 2h
};

// --- CORS
const allowlist = ['http://localhost:4200', 'https://omnia-wp.vercel.app'];
const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowlist.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));   // preflight
app.use(express.json());
app.use(cookieParser());

// --- APIs
app.get('/get-schedule', async (_req, res) => {
  try {
    const r = await pool.query('SELECT * FROM schedule;');
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  // TODO: validar con DB + bcrypt
  if (username === 'admin' && password === 'admin') {
    const token = jwt.sign({ sub: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
    res.cookie(COOKIE, token, COOKIE_OPTS);
    return res.sendStatus(204);
  }
  res.status(401).json({ error: 'bad_credentials' });
});

app.get('/me', (req, res) => {
  const token = req.cookies?.[COOKIE];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: payload.sub, role: payload.role });
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
  }
});

app.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...COOKIE_OPTS, maxAge: 0 });
  res.sendStatus(204);
});

// Static + fallback (si servís el build de Angular desde acá)
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));



