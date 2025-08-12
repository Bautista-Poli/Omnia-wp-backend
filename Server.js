// Server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { pool } = require('./Database.js');
const registerAuthRoutes = require('./auth.controller');
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


registerAuthRoutes(app);


app.get('/classes/names', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT name
      FROM classes
      ORDER BY name ASC
    `);
    
    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error('GET /classes/names error:', err.code, err.message);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});

app.get('/classes/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const { rows } = await pool.query(
      `
      SELECT
        c.src,
        c.description,
        c.profesorId,
        c.profesor2Id
      FROM classes c
      WHERE c.name = $1
      `,
      [name]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('GET /classes/:name error:', err.code, err.message);
    res.status(500).json({
      error: 'server_error',
      code: err.code,
      detail: err.message
    });
  }
});

app.post('/schedule', async (req, res) => {
  try {
    const { nombre_clase, horario, dia_semana } = req.body; // 👈 usar dia_semana

    const { rows } = await pool.query(
      `
      INSERT INTO schedule (nombre_clase, horario, dia_semana)
      VALUES ($1::text, $2::time, $3::int)
      RETURNING *;
      `,
      [nombre_clase, horario, dia_semana] // 👈 orden correcto
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /schedule payload:', req.body);
    console.error('POST /schedule error:', err.code, err.message, err.detail);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});


app.delete('/schedule', async (req, res) => {
  try {
    const { nombre_clase, horario, dia_semana } = req.body;

    const { rowCount } = await pool.query(
      `
      DELETE FROM schedule
      WHERE nombre_clase = $1::text
        AND horario = $2::time
        AND dia_semana = $3::int
      `,
      [nombre_clase, horario, dia_semana]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: rowCount });
  } catch (err) {
    console.error('DELETE /schedule payload:', req.body);
    console.error('DELETE /schedule error:', err.code, err.message, err.detail);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});

app.get('/profesores/names', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT nombre
      FROM profesor
      ORDER BY nombre ASC
    `);
    
    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error('GET /classes/names error:', err.code, err.message);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
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
        p.src
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



app.get('/schedule/slot', async (req, res) => {
  try {
    const { dia_semana, horario } = req.query;
    const { rows } = await pool.query(
      `
      SELECT id, nombre_clase, horario, dia_semana
      FROM schedule
      WHERE dia_semana = $1::int AND horario = $2::time
      LIMIT 1
      `,
      [dia_semana, horario]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /schedule/slot error:', err.code, err.message);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});

app.get('/get-schedule', async (_req, res) => {
  const r = await pool.query('SELECT * FROM schedule;');
  res.json(r.rows);
});



// Fallback Angular
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));



