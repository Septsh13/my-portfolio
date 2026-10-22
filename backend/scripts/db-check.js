require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const { pool } = require('../src/config/database');

(async () => {
  try {
    const { rows } = await pool.query('SELECT current_database() AS database, current_user AS username, version() AS version');
    console.log(`Connected to ${rows[0].database} as ${rows[0].username} (${rows[0].version.split(',')[0]})`);
  } finally {
    await pool.end();
  }
})().catch((error) => {
  console.error(`Database connection failed: ${error.message}`);
  process.exitCode = 1;
});
