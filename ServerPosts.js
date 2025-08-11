// server.js (añade esto)
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:4200', 'https://omnia-wp.vercel.app'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// --- Config sesión
const COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,          // en localhost http usa false, en prod true
  sameSite: 'none',      // si frontend y backend son dominios distintos -> 'none'
  path: '/',
  maxAge: 2 * 60 * 60 * 1000
};

// Login: valida credenciales y setea cookie
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  // TODO: validar contra DB + bcrypt. Por ahora hardcode:
  if (username === 'admin' && password === 'admin') {
    const token = jwt.sign({ sub: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
    res.cookie(COOKIE, token, COOKIE_OPTS);
    return res.sendStatus(204);
  }
  return res.status(401).json({ error: 'bad_credentials' });
});

// logout: borra cookie
app.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { ...COOKIE_OPTS, maxAge: 0 });
  res.sendStatus(204);
});
