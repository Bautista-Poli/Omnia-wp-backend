
const { Router } = require('express');
const { pool } = require('../Database'); 
const r = Router();

r.get('/profesores/names', async (_req, res) => {
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

r.get('/profesores/:id', async (req, res) => {
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


r.delete('/profesores', async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'bad_request', detail: 'nombre es requerido' });
    }

    await client.query('BEGIN');

    // 1) buscar id del profesor por nombre (case-insensitive)
    const prof = await client.query(
      `SELECT id FROM profesor WHERE LOWER(nombre) = LOWER($1) LIMIT 1`,
      [nombre]
    );
    if (prof.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found' });
    }
    const profesorId = prof.rows[0].id;

    // 2) limpiar referencias en classes
    await client.query(`UPDATE classes SET profesorId = NULL WHERE profesorId = $1`, [profesorId]);
    await client.query(`UPDATE classes SET profesor2Id = NULL WHERE profesor2Id = $1`, [profesorId]);

    // 3) borrar profesor
    const del = await client.query(`DELETE FROM profesor WHERE id = $1`, [profesorId]);
    await client.query('COMMIT');

    return res.json({ deleted: del.rowCount, profesorId });
  } catch (err) {
    await (async () => { try { await client.query('ROLLBACK'); } catch(_) {} })();
    console.error('DELETE /profesores payload:', req.body);
    console.error('DELETE /profesores error:', err.code, err.message, err.detail);
    // si querés distinguir FK:
    if (err.code === '23503') {
      return res.status(409).json({ error: 'conflict', detail: 'Profesor referenciado por classes' });
    }
    return res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = r;