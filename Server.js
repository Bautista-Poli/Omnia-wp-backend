// Server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { pool } = require('./Database.js');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:4200',
  'https://omnia-wp.vercel.app'
];

const corsOpts = {
  origin: (origin, cb) => {
    // permite curl/postman (sin Origin) y los origins de la lista
    if (!origin) return cb(null, true);
    cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
};

// CORS *antes* de todo
app.use(cors(corsOpts));
app.options('*', cors(corsOpts));  // <-- importante para preflight

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));

// ---------- Auth (cookie httpOnly)
const COOKIE = 'session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',       // prod: true, local: false
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: 2 * 60 * 60 * 1000,
};
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'admin') {
    const token = jwt.sign({ sub: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
    res.cookie(COOKIE, token, COOKIE_OPTS);
    return res.sendStatus(204);
  }
  return res.status(401).json({ error: 'bad_credentials' });
});

app.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE, { ...COOKIE_OPTS, maxAge: 0 });
  res.sendStatus(204);
});

app.get('/healthz', (_req,res)=>res.status(200).send('ok'));

app.get('/me', (req, res) => {
  try {
    const token = req.cookies?.[COOKIE];
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ user: payload.sub, role: payload.role });
  } catch {
    res.status(401).json({ error: 'unauthenticated' });
  }
});


app.get('/get-classesList', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name AS nombre, src, description
       FROM classes
       ORDER BY name ASC`
    );

    // si querés devolver también un slug:
    const list = rows.map(r => ({
      ...r,
      slug: String(r.nombre || '').trim().toLowerCase().replace(/\s+/g, '-')
    }));

    return res.json(list); // si está vacío -> []
  } catch (err) {
    console.error('GET /get-classesList error:', err);
    return res.status(500).json({ error: 'server_error' });
  }
});


app.get('/profesores/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'bad_request', detail: 'id must be integer' });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        p.nombre,
        p.src AS foto_url
      FROM profesor p
      WHERE p.id = $1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /profesores/:id error:', err.code, err.message);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});



// ---------- API existentes
app.get('/get-schedule', async (_req, res) => {
  const r = await pool.query('SELECT * FROM schedule;');
  res.json(r.rows);
});

// Fallback Angular
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));



