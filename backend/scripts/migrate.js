require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/database');

const migrationsDir = path.resolve(__dirname, '../../database/migrations');

(async () => {
  const check = await pool.query('SELECT current_database() AS database');
  console.log(`Verified connection to ${check.rows[0].database}; checking existing schema and backup before migrations.`);

  const hasLedger = await pool.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists");
  const pendingFiles = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  let applied = new Set();
  if (hasLedger.rows[0].exists) {
    const result = await pool.query('SELECT version FROM schema_migrations');
    applied = new Set(result.rows.map((row) => row.version));
  }
  const pending = pendingFiles.filter((file) => !applied.has(file.replace(/\.sql$/, '')));
  if (pending.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'");
  if (tables.rowCount > 0 && (!hasLedger.rows[0].exists || applied.size === 0)) {
    throw new Error(`Refusing to migrate a database with existing tables (${tables.rows.map((row) => row.tablename).join(', ')}). Back it up and review the schema before proceeding.`);
  }

  for (const file of pending) {
    const client = await pool.connect();
    const version = file.replace(/\.sql$/, '');
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
      await client.query('COMMIT');
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
})().catch((error) => {
  console.error(`Migration stopped safely: ${error.message}`);
  process.exitCode = 1;
}).finally(() => pool.end());
