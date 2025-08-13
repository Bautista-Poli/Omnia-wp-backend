// routes/schedule.js
const { Router } = require('express');
const { pool } = require('../Database');
const s = Router();


/**
 * POST /schedule/set-profesores
 * body: {
 *   nombre_clase: string,
 *   horario: "HH:MM" | "HH:MM:SS",
 *   dia_semana: number,
 *   nombreProfesor: string,   // "" => null
 *   nombreProfesor2: string   // "" => null
 * }
 */
s.post('/schedule/set-profesores', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      nombre_clase,
      horario,
      dia_semana,
      nombreProfesor,
      nombreProfesor2
    } = req.body || {};

    if (!nombre_clase || !horario || typeof dia_semana !== 'number') {
      return res.status(400).json({ error: 'bad_request', detail: 'Faltan campos requeridos' });
    }

    await client.query('BEGIN');

    // 1) class_id por nombre
    const qClase = 'SELECT id FROM classes WHERE nombre = $1 LIMIT 1';
    const rClase = await client.query(qClase, [nombre_clase]);
    if (rClase.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', detail: 'Clase no encontrada' });
    }
    const class_id = rClase.rows[0].id;

    // 2) profesores por nombre (acepta vacío => NULL)
    async function idProfesorPorNombre(nombre) {
      if (!nombre || !nombre.trim()) return null;
      const r = await client.query('SELECT id FROM profesor WHERE nombre = $1 LIMIT 1', [nombre.trim()]);
      if (r.rowCount === 0) {
        // si querés que falte y aún así setee null, devolvé null en vez de 404
        return null;
      }
      return r.rows[0].id;
    }

    const prof1Id = await idProfesorPorNombre(nombreProfesor);
    const prof2Id = await idProfesorPorNombre(nombreProfesor2);

    // 3) update del slot
    const qUpd = `
      UPDATE schedule
      SET profesor_id = $1,
          profesor2_id = $2
      WHERE class_id = $3
        AND dia_semana = $4
        AND horario = $5
      RETURNING id, class_id, dia_semana, horario, profesor_id, profesor2_id
    `;
    const rUpd = await client.query(qUpd, [prof1Id, prof2Id, class_id, dia_semana, horario]);

    if (rUpd.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', detail: 'Slot no encontrado' });
    }

    await client.query('COMMIT');
    return res.json({
      ok: true,
      updated: rUpd.rows[0]
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('POST /schedule/set-profesores error:', err);
    // errores FK si profesor_id no permite null o si la FK no matchea
    if (err.code === '23503') {
      return res.status(409).json({ error: 'conflict', detail: 'FK inválida: verifique nombres de profesores o permita NULLs' });
    }
    return res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

module.exports = s;
