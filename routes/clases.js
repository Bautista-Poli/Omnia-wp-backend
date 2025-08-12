// routes/clases.js
const { Router } = require('express');
const { pool } = require('../Database'); 
const r = Router();


r.get('/classes/names', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT name
      FROM classes
      ORDER BY name ASC
    `);
    res.json(rows.map(row => row.name));
  } catch (err) {
    console.error('GET /classes/names error:', err.code, err.message);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});

// GET /classes/:name
r.get('/classes/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { rows } = await pool.query(`
      SELECT
        c.src,
        c.description,
        c.profesorId,
        c.profesor2Id
      FROM classes c
      WHERE c.name = $1
    `, [name]);

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



r.delete('/class', async (req, res) => {
  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'bad_request', detail: 'nombre es requerido' });
    }

    const { rowCount } = await pool.query(
      `
      DELETE FROM classes
      WHERE LOWER(nombre) = LOWER($1::text)
      `,
      [nombre]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    res.json({ deleted: rowCount });
  } catch (err) {
    console.error('DELETE /classes payload:', req.body);
    console.error('DELETE /classes error:', err.code, err.message, err.detail);
    res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});


module.exports = r;
