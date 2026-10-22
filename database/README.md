# Portfolio PostgreSQL database

This folder contains the versioned schema and migration inventory. The seed importer at `seeds/import-existing-portfolio.js` reads the original `index.html` and preserves its text, relative image paths, category labels, project names, and GitHub URLs. It refuses to import into portfolio tables that already contain records.

## Local setup

1. Create a Supabase PostgreSQL project and copy its Session pooler URL (port `5432`). URL-encode special characters in the password.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` and `SUPABASE_CA_CERT_PATH=certs/prod-ca-2021.crt`. `.env` is ignored by Git.
3. From `backend`, run `npm install` and `npm run db:check`. The connection must pass TLS certificate verification before continuing.
4. Run `npm run db:migrate`, then `npm run db:seed`.

The migration runner verifies the connection and refuses to bootstrap a database with application tables but no migration history. Before applying a new migration to a database with data, create and verify a `pg_dump` backup. Migrations are transactional and recorded by version. The seed importer uses a transaction, stable IDs, and `ON CONFLICT DO NOTHING`; it never overwrites admin edits or replaces existing records.

For backups use `pg_dump "$DATABASE_URL" -Fc -f portfolio_db.backup`. Restore only into a known target database with `pg_restore` after reviewing the backup.
