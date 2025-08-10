const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  user: PGUSER,          // <- en pg es "user", no "username"
  password: PGPASSWORD,
  port: 5432,
  ssl: { require: true },
});

async function getQuery(text) {
  return pool.query(text);
}

// NUEVO: query con parámetros
async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = { getQuery, query, pool };

