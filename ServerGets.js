// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { pool } = require('./Database.js');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:4200','https://omnia-wp.vercel.app'], credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));

// (tus GET existentes)
app.get('/get-schedule', async (req, res) => {
  const r = await pool.query('SELECT * FROM schedule;');
  res.json(r.rows);
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

// fallback Angular
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});


app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));


