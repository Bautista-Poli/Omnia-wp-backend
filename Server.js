const express = require('express');
const path = require('path');
const cors = require('cors');
const { getQuery } = require('./Database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Reemplaza a body-parser
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));

// API: Recibir datos
app.post('/send-page', (req, res) => {
  const { name, descripcion } = req.body;
  console.log(name, descripcion);
  res.json({ message: 'POST recibido correctamente' });
});

// API: Enviar datos
app.get('/get-classesList', async (req, res) => {
  const responseData = await getQuery('SELECT * FROM classes;');
  res.json(responseData);
});

app.get('/get-profesorList', async (req, res) => {
  const responseData = await getQuery('SELECT * FROM profesor;');
  res.json(responseData);
});

app.get('/get-schedule', async (req, res) => {
  const responseData = await getQuery('SELECT * FROM schedule;');
  res.json(responseData);
});

// Angular routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
