# Deploying with Vercel, Render, and Supabase

This repository is configured for a Vercel frontend and a Render Express API. Vercel proxies `/api/*` to Render, so browser requests and admin session cookies remain on the frontend origin. Do not set `VITE_API_URL` for this setup.

## 1. Push the project to Git

Commit the project files, including `render.yaml` and `frontend/vercel.json`. Do not commit `.env`, database backups, or credentials. The database backups are ignored by Git.

## 2. Create the Supabase database

1. Create a Supabase project and open **Connect**.
2. Copy the **Session pooler** connection string (port `5432`). Render may not have IPv6 access to Supabase's direct database endpoint, while the shared session pooler supports IPv4. This backend uses persistent PostgreSQL sessions, so use session mode rather than transaction mode.
3. Replace the password placeholder with the database password. URL-encode reserved characters in it (`@`, `:`, `/`, `#`, `%`, spaces, and similar characters). The backend supplies its own verified TLS settings; any SSL parameters copied into the URL are removed before the pool is created.
4. Keep the connection string private. It is only used by backend/admin commands and Render, never by Vercel.

The public root certificate is tracked at `backend/certs/prod-ca-2021.crt`, so Render can use the repository copy by default. The Blueprint sets `SUPABASE_CA_CERT_PATH=certs/prod-ca-2021.crt` (relative to the `backend/` directory). If you prefer not to deploy the public CA in the repository, add a Render **Secret File** named `prod-ca-2021.crt` and set `SUPABASE_CA_CERT_PATH=/etc/secrets/prod-ca-2021.crt`. The certificate is public trust data, not a database credential; the connection password remains only in `DATABASE_URL` on Render and in the local ignored `.env`.

Before migrating an existing Supabase database, make a backup and review its tables. The migration runner refuses to bootstrap over an unmanaged schema. For a new, empty project, the commands below apply the schema and import missing records from the portfolio's saved source HTML. The seed uses `ON CONFLICT DO NOTHING`, so it will not replace existing edits.

## 3. Apply migrations and seed the portfolio

From PowerShell at the repository root, use the Supabase session-pooler URL from step 2:

```powershell
$env:DATABASE_URL = 'postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@POOLER_HOST:5432/postgres?sslmode=require'
Set-Location backend
npm ci
npm run db:check
npm run db:migrate
npm run db:seed
```

Confirm `db:check` reports the expected Supabase database before continuing. Migrations create the app schema and session table; the seed imports the existing profile, services, education, experience, skills, languages, categories, and projects. Keep `DATABASE_URL` set only in the current terminal, then clear it when finished:

```powershell
Remove-Item Env:DATABASE_URL
```

If this Supabase database already has portfolio records, the seed only adds missing stable records; it does not copy later changes made in your local admin dashboard. Transfer any such local edits separately before switching traffic.

## 4. Create the first admin account

Still in `backend`, bootstrap one administrator against Supabase. Choose the email and a unique password of at least 12 characters. The script refuses to create or reset an admin when one already exists.

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = Read-Host 'Admin email'
$securePassword = Read-Host 'Admin password (12+ characters)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:ADMIN_BOOTSTRAP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  npm run admin:bootstrap
} finally {
  Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL,Env:ADMIN_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
```

Save the credentials in your password manager. The database stores a bcrypt hash, not the password.

## 5. Deploy the backend to Render

1. In Render, create a **Blueprint** from this repository and select `render.yaml`, or create a Node web service with the same settings:
   - Build command: `npm ci --prefix backend`
   - Start command: `npm start --prefix backend`
   - Health check path: `/api/health`
2. Set `DATABASE_URL` to the same Supabase session-pooler URL.
3. Render's Blueprint generates `SESSION_SECRET` automatically. If creating the service manually, set `SESSION_SECRET` to a random secret of at least 32 characters (for example, generate one locally with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). Do not reuse the database password.
4. Set `FRONTEND_ORIGIN` to the exact production Vercel origin, with no trailing slash, for example `https://your-project.vercel.app`. Use your custom domain here if you use one.
5. Keep `NODE_ENV=production` and `COOKIE_SAME_SITE=lax`. `PORT` is supplied by Render.
6. Deploy and note the service URL, such as `https://portfolio-api.onrender.com`.

The initial schema migration and seed are run manually in step 3. For future schema changes, back up the database, run `npm run db:check` and `npm run db:migrate` against Supabase before deploying the code that requires those changes. Render's pre-deploy command is available on paid web-service plans; it is not required for this setup.

Optional contact-form delivery requires SMTP variables on Render: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. The portfolio and admin work without SMTP; contact submissions will report that email delivery is not configured.

## 6. Point Vercel at Render

1. Edit `frontend/vercel.json` and replace `YOUR-RENDER-SERVICE` in the API rewrite with the actual Render service hostname from step 5. Keep the `https://` scheme and `/api/:path*` suffix.
2. In Vercel, import the repository and set **Root Directory** to `frontend`.
3. Use the Vite defaults or set:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm ci`
4. Do not set `VITE_API_URL`; Vercel's rewrite serves the API on the same origin as the frontend.
5. Deploy. Set the Render `FRONTEND_ORIGIN` to the deployed Vercel URL (or custom domain), then redeploy the Render service after changing it.

## 7. Verify

Open these URLs, substituting your deployment hostnames:

- `https://your-project.vercel.app/` — portfolio content and images
- `https://your-project.vercel.app/admin/login` — admin sign-in
- `https://your-project.vercel.app/api/health` — should return `{"status":"ok","database":true}` through the Vercel proxy
- `https://portfolio-api.onrender.com/api/health` — should return the same health response directly

If the API health check fails, confirm Render's `DATABASE_URL` exactly matches the Supabase **Session pooler** URL and includes the correct URL-encoded password. If the page works but admin sign-in cannot establish a session, confirm the Vercel rewrite hostname, the exact `FRONTEND_ORIGIN`, and that both deployments use HTTPS.
