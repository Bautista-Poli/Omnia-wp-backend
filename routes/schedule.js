const { Router } = require('express');
const { pool } = require('../Database'); 
const r = Router();



r.post('/schedule', async (req, res) => {
  try {
    const { nombre_clase, horario, dia_semana, profesorId, profesor2Id } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO schedule (nombre_clase, horario, dia_semana, profesorId)
      VALUES ($1::text, $2::time, $3::int, $4::int, $5::int)
      RETURNING *;
      `,
      [
        nombre_clase,
        horario,
        dia_semana,
        profesorId ?? null,   // 👈 Si viene undefined, lo manda como null
        profesor2Id ?? null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /schedule payload:', req.body);
    console.error('POST /schedule error:', err.code, err.message, err.detail);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});



r.delete('/schedule', async (req, res) => {
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




r.get('/schedule/slot', async (req, res) => {
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

r.get('/get-schedule', async (_req, res) => {
  const r = await pool.query('SELECT * FROM schedule;');
  res.json(r.rows);
});

module.exports = r;