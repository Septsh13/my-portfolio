# Seed and import scripts

`import-existing-portfolio.js` imports the original static data snapshot in `source-portfolio.html`. It retains the current text, relative image paths, project category names, and all project GitHub URLs. Stable IDs and `ON CONFLICT DO NOTHING` make it safe to run again without replacing administrator changes.

Run from `backend` with `npm run db:seed` after applying migrations.
