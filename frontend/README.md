# Frontend

React and Vite frontend that preserves the original vCard styles and static assets while loading editable content from the backend. The portfolio is public; `/admin/login` and `/admin` are the management routes. Admin authorization is enforced by the API, not by the route UI.

Requires Node.js 20 or later. From this directory:

```sh
npm install
npm run dev
npm run build
npm run preview
```

Development proxies `/api` to `http://localhost:3000`. For separate deployments set `VITE_API_URL` to the backend origin at build time. The frontend contains no database, session, or mail credentials. Build output is `dist/`.
