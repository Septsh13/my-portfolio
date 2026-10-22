# V S Septsh Kumar — portfolio

The existing vCard portfolio is now a React frontend backed by an Express API and PostgreSQL. It retains the original design system and ships the original static images and links. Public data is read from PostgreSQL; the authenticated admin dashboard manages the profile, About content, services, resume, skills, languages, project categories, projects, contact settings, and password.

## Structure

```text
frontend/   React/Vite app and public copy of original static assets
backend/    Express API, PostgreSQL access, auth and mail configuration
database/   SQL migrations, schema, source snapshot and idempotent importer
```

The data inventory and conversion plan is in [MIGRATION_PLAN.md](MIGRATION_PLAN.md). The original source and current PostgreSQL data were backed up under `database/backups/` before migration. The original HTML snapshot used by the importer is `database/seeds/source-portfolio.html`; static image paths remain in `frontend/public/assets/`.

## Requirements and first run

Install Node.js 20+, PostgreSQL, and Git. The local database is `portfolio_db` on `localhost:5432`. If creating it for the first time, run `createdb -h localhost -p 5432 -U postgres portfolio_db` (or create it in pgAdmin).

1. Configure `backend/.env` from [backend/.env.example](backend/.env.example). Set `DATABASE_URL`, `PORT=3000`, `NODE_ENV=development`, `FRONTEND_ORIGIN=http://localhost:5173`, and a strong `SESSION_SECRET`. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
2. Apply schema and import the original portfolio without replacing existing records:

   ```sh
   cd backend
   npm install
   npm run db:check
   npm run db:migrate
   npm run db:seed
   ```

   Verify the connection before migrations. Back up a database with `pg_dump -h localhost -p 5432 -U postgres -Fc portfolio_db -f portfolio_db.backup` before applying later migrations to an already populated database. The migration runner records versions and will not bootstrap over an unmanaged schema.

3. Create the initial admin account once. In PowerShell, from `backend`:

   ```powershell
   $env:ADMIN_BOOTSTRAP_EMAIL = Read-Host "Administrator email"
   $securePassword = Read-Host "Temporary administrator password (12+ characters)" -AsSecureString
   $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
   $env:ADMIN_BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
   npm run admin:bootstrap
   Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL,Env:ADMIN_BOOTSTRAP_PASSWORD
   [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
   ```

   The command stores only a bcrypt hash and refuses to reset/recreate an existing admin. There is no public registration. Change the bootstrap password after first login if it was temporary.

4. Start the API in one terminal:

   ```sh
   cd backend
   npm run dev
   ```

5. Start Vite in another terminal:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

Open `http://localhost:5173`; admin login is `http://localhost:5173/admin/login`.

## Admin use

Sign in with the bootstrap account. The dashboard statistics come from PostgreSQL. Use the section navigation to edit profile and About fields or add, edit, reorder, publish/unpublish, and delete repeatable records. Project creation requires a name, an image, and a project link; project categories are optional. Uploads accept JPEG, PNG, GIF, and WebP up to 8 MB. New image bytes are stored in PostgreSQL and served through `/api/media/:id`; deleting a project never deletes a potentially shared image.

Contact settings control the message recipient, displayed contact details, heading, description, and form availability. Configure SMTP only in backend environment variables: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. Without SMTP, the form returns an explicit delivery-not-configured error. SMTP secrets never reach the frontend.

## Backups and deployment

Back up PostgreSQL regularly with `pg_dump -Fc`; restore into a reviewed target database with `pg_restore`. Keep the database backup and persistent media rows together.

For the Vercel + Render + Supabase deployment steps, including database migration and admin bootstrap, see [DEPLOYMENT.md](DEPLOYMENT.md). Vercel proxies `/api/*` to Render so admin session cookies stay same-origin; leave `VITE_API_URL` unset for that setup.

## Verification and troubleshooting

`npm run db:check` verifies PostgreSQL access; `npm run db:migrate` applies pending SQL; `npm run db:seed` re-imports only missing stable records. The smoke-check script exercises public access, admin boundaries, CSRF, project CRUD/publishing, and logout after the API is running and bootstrap credentials are set as `SMOKE_ADMIN_EMAIL` and `SMOKE_ADMIN_PASSWORD` in the test process. `npm run build` verifies the frontend bundle.

- Database connection errors: check PostgreSQL service, port, username/password URL encoding, and `DATABASE_URL`.
- Admin route returns 401: bootstrap the first admin and log in again.
- API reports invalid CSRF: reload the admin page so it can obtain a current CSRF token.
- Contact message reports delivery unavailable: configure SMTP environment variables and verify provider credentials.
- Cross-origin browser errors: set `FRONTEND_ORIGIN` to the exact frontend origin and `VITE_API_URL` to the API origin.

Never commit `.env`, database dumps, upload data, or secrets. `.gitignore` excludes these local files.
