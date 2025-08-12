// Server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const registerAuthRoutes = require('./auth.controller');
const app = express();
const PORT = process.env.PORT || 3000;


const clasesRouter = require('./routes/clases.js');
const profesoresRouter = require('./routes/profesores.js');
const scheduleRouter = require('./routes/schedule.js');

const allowedOrigins = [
  'http://localhost:4200',
  'https://omnia-wp.vercel.app'
];

const corsOpts = {
  origin: (origin, cb) => {
    // permite curl/postman (sin Origin) y los origins de la lista
    if (!origin) return cb(null, true);
    cb(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'],
};

// CORS *antes* de todo
app.use(cors(corsOpts));
app.options('*', cors(corsOpts));  // <-- importante para preflight

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist/omnia/browser')));


registerAuthRoutes(app);

app.use(clasesRouter);
app.use(profesoresRouter);
app.use(scheduleRouter);


// Fallback Angular
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist/omnia/browser/index.html'));
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));



