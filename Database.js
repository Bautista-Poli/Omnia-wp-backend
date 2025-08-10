// Database.js
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  user: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: { require: true },
});

async function getQuery(text, params = []) {
  const r = await pool.query(text, params);
  return r.rows;
}

module.exports = { pool, getQuery };
