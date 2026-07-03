# FishSlayR — Vite + React build

This is the modernized build of FishSlayR: same app, same look, now as a
Vite + React project with a real module structure. Supabase stays the backend
(no Node server). Hosting stays on GitHub Pages.

## Run it locally

```bash
npm install      # first time only
npm run dev      # start the dev server (hot reload) — open the printed URL
```

To test a real production build the way Pages will serve it:

```bash
npm run build    # outputs to dist/
npm run preview  # serves the built dist/ locally
```

## Project layout

```
index.html                 Vite entry (root div + module script)
vite.config.js             base: '/FishSlayRBeta/'  ← must match the Pages sub-path
src/
  main.jsx                 React entry
  App.jsx                  App shell: nav rail + mode + screen routing
  styles/app.css           the original app CSS, carried over intact
  lib/
    supabase.js            Supabase client (also set on window.sb during migration)
    useAuth.js             auth hook (Google OAuth sign-in/out, live state)
  components/
    Boathouse.jsx          first ported screen
    CloudButton.jsx        sign-in / account control
public/                    manifest, icons, service worker (copied as-is)
.github/workflows/deploy.yml   builds Vite and deploys dist/ to Pages
```

## What's done vs. pending

Done: toolchain (Vite/React/build), Pages base path, CSS, Supabase client,
auth hook, app shell + nav, Boathouse screen (visual), Cloud sign-in button,
deploy workflow.

Pending (ported screen by screen next): the data layer (seasons/sessions/
catches from localStorage + IndexedDB), the sync engine, and the remaining
screens — Livewell, Journal, Intelligence, Waters, Tackle, Legends, Rig Box —
plus catch/trip sheets, photos, and trip templates.

## Deploying

The workflow triggers on push to `main` and REPLACES the old Jekyll workflow.
Do the migration on the `vite-migration` branch and only merge to `main` when
the React build reaches parity with the current single-file app. Merging swaps
the deploy to Vite in one step; reverting the merge restores the old app.

Before the first Pages deploy from this build: repo Settings → Pages → Source
should be "GitHub Actions" (it already is). No other Pages settings change.
