const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Configure it in backend/.env or the hosting provider environment.');
}

const backendRoot = path.resolve(__dirname, '../..');
const certificatePath = path.resolve(
  backendRoot,
  process.env.SUPABASE_CA_CERT_PATH || 'certs/prod-ca-2021.crt'
);

let caCertificate;
try {
  caCertificate = fs.readFileSync(certificatePath, 'utf8');
  tls.createSecureContext({ ca: caCertificate });
} catch (error) {
  if (error.code === 'ENOENT' || error.code === 'EACCES') {
    throw new Error(`Cannot read the Supabase CA certificate at ${certificatePath}. Set SUPABASE_CA_CERT_PATH to its location.`);
  }
  throw new Error(`The Supabase CA certificate at ${certificatePath} is not a valid PEM certificate.`);
}

// node-postgres replaces the explicit ssl object if sslmode/sslrootcert/etc.
// are present in the URL, so remove all URL SSL options before pool creation.
let databaseUrl;
try {
  const parsedUrl = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('Invalid PostgreSQL URL protocol.');
  }
  const sslParameters = new Set(['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl']);
  for (const parameter of [...parsedUrl.searchParams.keys()]) {
    if (sslParameters.has(parameter.toLowerCase())) parsedUrl.searchParams.delete(parameter);
  }
  databaseUrl = parsedUrl.toString();
} catch (error) {
  throw new Error(`DATABASE_URL must be a valid PostgreSQL URL. ${error.message}`);
}

function safeDatabaseError(error) {
  const certificateErrors = new Set([
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_UNTRUSTED',
    'DEPTH_ZERO_SELF_SIGNED_CERT'
  ]);
  if (certificateErrors.has(error?.code)) {
    return 'TLS certificate verification failed. Check that SUPABASE_CA_CERT_PATH points to the current Supabase CA certificate.';
  }
  if (error?.code === 'CERT_HAS_EXPIRED') {
    return 'TLS certificate validation failed because a certificate has expired. Download the current Supabase CA certificate.';
  }
  if (/server does not support ssl connections/i.test(error?.message || '')) {
    return 'The configured PostgreSQL endpoint does not support TLS. For Supabase, confirm DATABASE_URL uses the Supabase database or Session pooler host, not localhost.';
  }
  return String(error?.message || 'Unknown PostgreSQL connection error')
    .replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, 'postgresql://[redacted]')
    .replace(/(password\s*=\s*)[^\s;]+/gi, '$1[redacted]');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true
  }
});

pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error:', safeDatabaseError(error)));

module.exports = { pool, safeDatabaseError };
