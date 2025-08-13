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

// Helper: extraer public_id desde la URL de Cloudinary
function publicIdFromCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    // /<cloud>/image/upload/(opcional v123)/carpeta/archivo.ext
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'upload');
    if (idx === -1) return null;

    let start = idx + 1;
    if (parts[start] && /^v\d+$/.test(parts[start])) start++; // saltear v123 si está

    // Lo que queda: carpeta/archivo.ext -> remover extensión
    const rest = parts.slice(start).join('/');
    return rest.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}
function publicIdFromCloudinaryUrl(url) {
  try {
    const u = new URL(url);
    // /<cloud>/image/upload/(opcional v123)/carpeta/archivo.ext
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'upload');
    if (idx === -1) return null;

    let start = idx + 1;
    if (parts[start] && /^v\d+$/.test(parts[start])) start++; // saltear v123 si está

    // Lo que queda: carpeta/archivo.ext -> remover extensión
    const rest = parts.slice(start).join('/');
    return rest.replace(/\.[^/.]+$/, '');
  } catch {
    return null;
  }
}

r.delete('/class', async (req, res) => {
  try {
    const { nombre, name } = req.body;
    // Acepto "nombre" o "name" para mayor comodidad
    const className = ((name || nombre) || '').trim();
    if (!className) {
      return res.status(400).json({ error: 'bad_request', detail: 'name es requerido' });
    }

    // 1) Traer todas las filas que matcheen el nombre (case-insensitive)
    const { rows } = await pool.query(
      `
      SELECT id, name, src
      FROM classes
      WHERE LOWER(name) = LOWER($1::text)
      `,
      [className]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'not_found' });
    }

    // 2) Intentar borrar en Cloudinary (best-effort)
    const cloudinaryResults = [];
    for (const r of rows) {
      const pid = publicIdFromCloudinaryUrl(r.src);
      if (!pid) {
        cloudinaryResults.push({ id: r.id, status: 'skip', reason: 'public_id_invalido' });
        continue;
      }
      try {
        const destroyRes = await cloudinary.uploader.destroy(pid, { resource_type: 'image' });
        cloudinaryResults.push({ id: r.id, status: 'ok', public_id: pid, result: destroyRes?.result });
      } catch (e) {
        cloudinaryResults.push({
          id: r.id,
          status: 'error',
          public_id: pid,
          error: e?.message || 'cloudinary_destroy_failed'
        });
      }
    }

    // 3) Borrar filas en DB
    const del = await pool.query(
      `
      DELETE FROM classes
      WHERE LOWER(name) = LOWER($1::text)
      `,
      [className]
    );

    return res.json({
      deleted: del.rowCount,
      name: className,
      cloudinary: cloudinaryResults
    });
  } catch (err) {
    console.error('DELETE /class error:', err.code, err.message, err.detail);
    return res.status(500).json({ error: 'server_error', code: err.code, detail: err.message });
  }
});



module.exports = r;
