// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { pool } = require('./Database.js'); // exportá pool
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:4200','https://omnia-wp.vercel.app'], credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));

// Nuevo: crear entrada en schedule con verificación
app.post('/schedule', async (req, res) => {
  try {
    const { nombre_clase, horario, dia_semana } = req.body;

    if (!nombre_clase || !horario || !Number.isInteger(dia_semana)) {
      return res.status(400).json({ error: 'Faltan campos (nombre_clase, horario, dia_semana)' });
    }

    // Normalizamos HH:mm:ss (por si viene "19:00")
    const h = horario.length === 5 ? `${horario}:00` : horario;

    // Chequeo explícito (opcional porque el UNIQUE lo garantiza)
    const exists = await pool.query(
      'SELECT 1 FROM schedule WHERE dia_semana=$1 AND horario=$2 LIMIT 1',
      [dia_semana, h]
    );
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'slot_taken' });
    }

    const ins = await pool.query(
      'INSERT INTO schedule (nombre_clase, horario, dia_semana) VALUES ($1,$2,$3) RETURNING *',
      [nombre_clase, h, dia_semana]
    );
    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    // Si la UNIQUE se dispara:
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'slot_taken' });
    }
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// (tus GET existentes)
app.get('/get-schedule', async (req, res) => {
  const r = await pool.query('SELECT * FROM schedule;');
  res.json(r.rows);
});



app.get('/schedule/minute', async (req, res) => {
  try {
    const dia  = parseInt(req.query.dia, 10);
    const hora = String(req.query.hora || '').slice(0, 5); // "HH:mm"
    if (!Number.isInteger(dia) || !/^\d{2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: 'bad_params' });
    }

    const q = await pool.query(
      `SELECT id, nombre_clase, horario, dia_semana
      FROM schedule
      WHERE dia_semana = $1
      AND date_trunc('minute', horario) = date_trunc('minute', $2::time)
      ORDER BY horario ASC`,
      [dia, hora + ':00']
    );
    
    res.json(q.rows); // siempre JSON (aunque sea [])
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  }
});

// fallback Angular
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));


