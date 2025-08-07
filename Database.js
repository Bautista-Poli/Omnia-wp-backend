const {Pool} = require('pg');
const dotenv = require('dotenv');
dotenv.config();
//npm i -g neonctl

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;
const pool = new Pool({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: {
    require: true,
  },
});



async function getQuery(text) {
  try {
    const result = await pool.query(text);
    return result.rows;
  } catch (error) {
    console.error('Error executing query:', error);
  }
}

const queryText = 'SELECT * FROM classes';
(async () => {
  try {
    var result = await getQuery(queryText);
    console.log(result);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
});


module.exports = { getQuery };