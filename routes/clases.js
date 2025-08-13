// routes/clases.js
const { Router } = require('express');
const { pool } = require('../Database'); 
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const r = Router();

// Cloudinary lee CLOUDINARY_URL del entorno automáticamente.
// Solo forzamos HTTPS en las URLs:
cloudinary.config({ secure: true });

// Multer en memoria (no escribe a disco del servidor)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes'), false);
    }
    cb(null, true);
  }
});


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
        c.description
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

r.post('/upload-class', upload.single('photo'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const description = (req.body.description || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'bad_request', detail: 'name es requerido' });
    }
    if (!description) {
      return res.status(400).json({ error: 'bad_request', detail: 'description es requerida' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'bad_request', detail: 'photo es requerida' });
    }

    // Subir imagen a Cloudinary desde el buffer
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'classes', resource_type: 'image' },
        (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
      );
      stream.end(req.file.buffer);
    });

    const photoUrl = result.secure_url;

    // Guardar en la tabla classes
    const insertSql = `
      INSERT INTO classes (name, description, src)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, src
    `;
    const { rows } = await pool.query(insertSql, [name, description, photoUrl]);

    return res.status(201).json(rows[0]);

  } catch (err) {
    console.error('POST /upload-class error:', err);

    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'upload_error', detail: err.message });
    }
    return res.status(500).json({ error: 'server_error', detail: 'No se pudo subir la clase' });
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
