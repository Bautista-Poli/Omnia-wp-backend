// routes/profesores.js
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

/* ======================
   Rutas existentes (tuyas)
   ====================== */

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
      `SELECT p.nombre, p.src
       FROM profesor p
       WHERE p.id = $1`,
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

/* ======================
   Nueva: subir profesor + foto
   Path: POST /upload-profesor
   Form fields:
     - name  (string)
     - photo (file)
   ====================== */
r.post('/upload-profesor', upload.single('photo'), async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'bad_request', detail: 'name es requerido' });
    if (!req.file) return res.status(400).json({ error: 'bad_request', detail: 'photo es requerida' });

    // Subir a Cloudinary desde el buffer
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'profesores', resource_type: 'image' },
        (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
      );
      stream.end(req.file.buffer);
    });

    const photoUrl = result.secure_url;
    
    const insertSql = `
      INSERT INTO profesor (nombre, src)
      VALUES ($1, $2)
      RETURNING id, nombre, src
    `;
    const { rows } = await pool.query(insertSql, [name, photoUrl]);

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /upload-profesor error:', err);
    // Errores de Multer
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'upload_error', detail: err.message });
    }
    return res.status(500).json({ error: 'server_error', detail: 'No se pudo subir el profesor' });
  }
});

module.exports = r;

