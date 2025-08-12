
const { Router } = require('express');
const { pool } = require('../Database'); 
const r = Router();

app.get('/profesores/names', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT nombre
      FROM profesor
      ORDER BY nombre ASC
    `);
    
    res.json(rows.map(r => r.nombre));
  } catch (err) {
    console.error('GET /profesores/names error:', err.code, err.message);
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

app.delete('/profesores', async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'bad_request', detail: 'nombre es requerido' });
    }

    const { rowCount } = await pool.query(
      `
      DELETE FROM profesor
      WHERE LOWER(nombre) = LOWER($1::text)
      `,
      [nombre]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json({ deleted: rowCount });
  } catch (err) {
    console.error('DELETE /profesores payload:', req.body);
    console.error('DELETE /profesores error:', err.code, err.message, err.detail);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});

module.exports = r;