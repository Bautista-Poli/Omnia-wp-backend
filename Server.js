// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const { pool, query } = require('./Database.js');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ['http://localhost:4200','https://omnia-wp.vercel.app'], credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));

// Nuevo: crear entrada en schedule con verificación
app.post('/schedule', async (req, res) => {
  try {
    let { nombre_clase, horario, dia_semana } = req.body;

    if (!nombre_clase || !horario || !Number.isInteger(dia_semana)) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    nombre_clase = String(nombre_clase).trim();

    // Acepta "HH:mm" o "HH:mm:ss"
    if (/^\d{2}:\d{2}$/.test(horario)) {
      horario = horario + ':00';
    } else if (!/^\d{2}:\d{2}:\d{2}$/.test(horario)) {
      return res.status(400).json({ error: 'bad_time_format' });
    }

    // Chequeo por MINUTO (evitamos problemas con time/date_trunc):
    // comparamos HH:MM de ambos
    const clash = await query(
      `SELECT id, nombre_clase, horario
         FROM schedule
        WHERE dia_semana = $1
          AND to_char(horario, 'HH24:MI') = to_char($2::time, 'HH24:MI')
        ORDER BY horario`,
      [dia_semana, horario]
    );

    if (clash.rows.length) {
      const same = clash.rows.some(
        r => r.nombre_clase.trim().toLowerCase() === nombre_clase.toLowerCase()
      );
      if (same) {
        // misma clase ya en ese minuto → bloquear siempre
        return res.status(409).json({ error: 'same_class' });
      }
      // hay otra clase en ese minuto
      const isSecond01 = horario.endsWith(':01');
      return res.status(409).json({
        error: isSecond01 ? 'slot_taken_second01' : 'slot_taken',
        occupants: clash.rows
      });
    }

    // Insert respetando lo que vino (:00 o :01)
    const ins = await query(
      `INSERT INTO schedule (nombre_clase, horario, dia_semana)
       VALUES ($1, $2::time, $3)
       RETURNING *`,
      [nombre_clase, horario, dia_semana]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (err) {
    console.error('POST /schedule error:', err); // mirá logs en Railway
    if (err.code === '23505') {
      // por si tenés UNIQUE (dia_semana, horario)
      return res.status(409).json({ error: 'slot_taken_exact' });
    }
    return res.status(500).json({ error: 'server_error', detail: String(err?.message || err) });
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


