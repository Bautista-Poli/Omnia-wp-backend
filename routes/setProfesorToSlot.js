// routes/setProfesorToSlot.js
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

    // helper: id de profesor por nombre (si no existe o viene vacío -> null)
    async function idProfesorPorNombre(nombre) {
      if (!nombre || !nombre.trim()) return null;
      const r = await client.query(
        'SELECT id FROM profesor WHERE nombre = $1 LIMIT 1',
        [nombre.trim()]
      );
      return r.rowCount ? r.rows[0].id : null;
    }

    const prof1Id = await idProfesorPorNombre(nombreProfesor);
    const prof2Id = await idProfesorPorNombre(nombreProfesor2);

    // UPDATE por nombre_clase + dia_semana + horario (case-insensitive para nombre_clase)
    const qUpd = `
      UPDATE schedule
      SET "profesorId"  = $1,
          "profesor2Id" = $2
      WHERE nombre_clase ILIKE $3
        AND dia_semana = $4
        AND horario    = $5
      RETURNING id, nombre_clase, dia_semana, horario, "profesorId", "profesor2Id"
    `;
    const rUpd = await client.query(qUpd, [
      prof1Id,
      prof2Id,
      nombre_clase,
      dia_semana,
      horario
    ]);

    if (rUpd.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'not_found', detail: 'Slot no encontrado' });
    }

    await client.query('COMMIT');
    return res.json({ ok: true, updated: rUpd.rows[0] });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('POST /schedule/set-profesores error:', err);
    // FK inválida
    if (err.code === '23503') {
      return res.status(409).json({ error: 'conflict', detail: 'FK inválida: revise nombres de profesores o permita NULL' });
    }
    // NOT NULL violado
    if (err.code === '23502') {
      return res.status(409).json({ error: 'conflict', detail: 'La columna profesorId/profesor2Id no permite NULL' });
    }
    return res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

module.exports = s;