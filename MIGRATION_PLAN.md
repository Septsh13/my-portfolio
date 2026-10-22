# Portfolio conversion plan

## Inventory before conversion

- The public site is a static vCard page in `index.html`, styled by `assets/css/style.css` and wired by `assets/js/script.js`.
- The asset tree has 37 files (about 1.7 MB): 11 JPEGs, 3 PNGs, 6 SVGs, 1 ICO, 1 CSS, 1 JS and 13 text files. Keep all image assets and their relative names; the text files alongside project images hold original repository links and must be reviewed against the HTML.
- Existing HTML inventory: profile/sidebar and three social links; two About paragraphs; four service cards; three education entries; one Supraja Technologies experience; four skills; three languages; five project filters and thirteen project cards; Formspree contact form and a project image modal.
- PostgreSQL `portfolio_db` already has the first migration and imported records. Back it up before expanding the schema. Existing records, media paths and links are retained and upgraded in place.
- There is no existing admin, API, app framework, or downloadable resume file.

## Implementation plan

1. Preserve the current website and database with recoverable backups.
2. Add a React/Vite frontend in `frontend`; copy static assets unchanged, then render the existing visual language and behaviors from the public API.
3. Add an Express backend in `backend`, with PostgreSQL migrations, validation, parameterized SQL, rate limiting, secure session cookies, CSRF protection, password bootstrap and protected admin APIs.
4. Expand the schema in `database/migrations` for users, durable sessions, profile/socials, portfolio sections, multi-category projects, binary image storage, contact settings and mail delivery configuration. Keep existing imported records and stable IDs.
5. Build the public portfolio and a responsive dashboard with CRUD/reordering for all editable sections, project uploads/publication and contact settings.
6. Verify migration/data counts, API authentication boundaries, public rendering, frontend build and local runtime; document email and deployment configuration and disclose any external setup that cannot be exercised locally.

## Image and data strategy

Keep existing image files in the frontend's static assets so their current references continue to work. New uploads are validated image binaries stored in PostgreSQL with MIME type, filename, size and alt text metadata; the API serves them by ID. This avoids ephemeral host disks and keeps uploaded image references durable with the database. Project categories use a many-to-many relation. Existing project URLs and image paths are imported from the original HTML and companion link text files without inventing missing data.

## Completed migration record

- Archived the exact original HTML/assets in `database/backups/original-portfolio-source.zip`; also moved the source HTML and original asset directory under `database/backups/`. The seeder uses its preserved HTML snapshot under `database/seeds/`.
- Copied all 37 asset files into `frontend/public/assets/` and verified matching SHA-256 hashes. The 13 GitHub URLs in the HTML match their companion text files.
- Preserved 13 projects, 5 categories, 4 services, 3 education records, 1 experience, 4 skills, and 3 languages in PostgreSQL. Five migrations are recorded. Re-running the importer leaves existing admin edits intact.
- Smoke checks cover public/private response boundaries, authenticated CRUD across resource collections, CSRF and logout, category deletion constraints, PostgreSQL image upload, project publication visibility, and unconfigured email reporting. Frontend build and dependency audits pass.
