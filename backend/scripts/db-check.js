require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
const { pool, safeDatabaseError } = require('../src/config/database');

(async () => {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT current_database() AS database');
    const socket = client.connection?.stream;
    if (!socket?.encrypted || socket.authorized !== true) {
      throw new Error('PostgreSQL connected without a certificate-verified TLS session.');
    }
    console.log(`Connected securely to database ${rows[0].database}; TLS ${socket.getProtocol()} certificate verified.`);
  } catch (error) {
    console.error(`Database connection failed: ${safeDatabaseError(error)}`);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
})();
