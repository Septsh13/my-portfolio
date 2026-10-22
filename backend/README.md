# Backend

Express REST API, PostgreSQL pool, HTTP-only sessions in PostgreSQL, administrator bootstrap, file validation, and SMTP contact delivery.

## Local setup

Requires Node.js 20 or later and PostgreSQL. From this directory:

```sh
copy .env.example .env
npm install
npm run db:check
npm run db:migrate
npm run db:seed
```

Set `DATABASE_URL` and generate `SESSION_SECRET` using `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Keep secrets only in this ignored `.env` or in the deployment provider's secret environment. URL-encode special characters in PostgreSQL passwords.

PostgreSQL connections use the tracked public Supabase root CA at `certs/prod-ca-2021.crt` by default. `SUPABASE_CA_CERT_PATH` can override this path; relative paths are resolved from `backend/`. The pool verifies the CA and host (`rejectUnauthorized: true`). SSL options in `DATABASE_URL` are removed so they cannot override the explicit TLS settings. `npm run db:check` confirms both encryption and certificate authorization. On Render, either use the tracked certificate (no path override required) or upload it as a Secret File named `prod-ca-2021.crt` and set `SUPABASE_CA_CERT_PATH=/etc/secrets/prod-ca-2021.crt`.

Create the first administrator once. Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` in the process environment, then run `npm run admin:bootstrap`. On Windows PowerShell you can use `Read-Host -AsSecureString` for the password before invoking the script. The command refuses to replace an existing administrator. Remove the bootstrap password from the environment after it succeeds. There is no public registration route.

Start with `npm run dev` or `npm start`. Health check: `GET /api/health`. Authentication uses a PostgreSQL session store, `HttpOnly` cookies, regenerated sessions, CSRF tokens on state-changing admin requests, login rate limiting, and server-side authorization. In production set `NODE_ENV=production`, `SESSION_SECRET`, and the exact frontend origin; serve the API over HTTPS. `COOKIE_SAME_SITE=lax` is appropriate for same-site hosting; when the frontend and API are on separate sites set `COOKIE_SAME_SITE=none` (secure cookies require HTTPS).

## Email

Contact email delivery requires `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. The recipient address is read from `contact_settings` in PostgreSQL and can be changed in Admin → Contact settings. If SMTP is not configured or delivery fails, the public form reports an error instead of claiming success.

## API outline

- Public read: `GET /api/portfolio` (published records only), `GET /api/health`, `GET /api/media/:id`.
- Auth: `GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password`.
- Admin CRUD: `/api/admin/profile`, `/about`, `/services`, `/education`, `/experiences`, `/skills`, `/skill-categories`, `/languages`, `/project-categories`, `/projects`, `/contact-settings`, `/dashboard`.
- Upload: `POST /api/media` with `multipart/form-data` field `image`; 8 MB maximum, validated JPEG/PNG/GIF/WebP bytes stored in PostgreSQL.
- Contact: `POST /api/contact`.

All admin writes require an authenticated session and the session's `X-CSRF-Token`. SQL uses parameters. Project edits, category assignments, profile social links, and import operations use transactions where related rows are updated together.
