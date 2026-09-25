# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A collection of small classroom games for a teacher to run during a live, screen-shared online class (see `project-spec.md` for full specs). There is no student-facing device, login, or realtime multiplayer — the teacher runs everything on one device.

## Commands

```
npm run dev       # Vite dev server, includes a local /api/data stub (see below)
npm run build     # production build
npm run preview   # preview the production build
```

There is no test suite and no linter configured.

## Architecture

**Routing:** `src/App.jsx` is the only router. Each game is a single top-level route component under `src/games/<game>/`, plus an optional `/:setId` (or `/:studentId` for whiteboard) route for shared/direct links. `src/pages/Home.jsx` lists the games (the `GAMES` array there controls what shows on the home screen, including not-yet-built placeholders with `enabled: false`).

**Storage model:** every game persists through the same tiny key/value contract, not a real backend:
- `src/lib/storage.js` — `getJSON`/`setJSON`/`removeItem` wrap `fetch('/api/data?key=...')`. Reads are public for game data; writes always require a passphrase, sent as `x-app-passphrase` and cached in `localStorage`. On a 401 it `window.prompt()`s for the passphrase and retries once.
- `api/data.js` — the production Vercel function. Backed by Redis (`ioredis`, `REDIS_URL` env var). Only an allow-listed set of key names/patterns (`BASE_KEYS`, per-teacher suffixed variants, whiteboard board keys) can be read or written — see `isAllowedKey`. Whiteboard keys additionally require the passphrase to *read* (private student notes), unlike every other game's keys, which are publicly readable so a share link works with no login.
- `vite.config.js` has a `devDataApi()` plugin that fakes the same `/api/data` contract locally against a gitignored `.dev-data.json` file, with no passphrase check. It only runs under `vite dev` (`apply: "serve"`) and never ships. If a local `npm run dev` session ever hits "Couldn't load your sets", suspect this stub before the real API.
- `src/lib/sets.js` — shared helpers every game (except whiteboard) builds on: `loadOwnSets` (the signed-in teacher's own sets) and `findSharedSet` (resolves a `/game/:setId` link by searching every teacher's space, since a shared link can be opened by anyone).

**Teacher spaces:** `src/lib/teacher.js`. Two hardcoded teachers share the app. Every storage key is suffixed per teacher (`teacherKey()`) except Wanderley's, who keeps the original un-suffixed keys for backward compatibility with links/data that predate multi-teacher support. This is an organizational split, not a security boundary. The active teacher is chosen on `Home` and stored in `localStorage`; a custom `teacher-changed` window event notifies UI (like the palette toggle) that lives outside the router and can't rely on route re-renders.

**Theme vs. palette:** two independent, separately-stored preferences, each with its own hook:
- `src/lib/theme.js` (`useTheme`) — light/dark, per-device (`localStorage`, unscoped), follows system preference until manually overridden.
- `src/lib/palette.js` (`usePalette`) — accent color (green/violet), stored per-teacher since the two teachers share one browser. Both apply state via a `data-*` attribute on `document.documentElement`, read by CSS in `src/styles/tokens.css`.

**Per-game structure:** each game under `src/games/<name>/` is one large component file plus one co-located CSS file (no CSS modules, plain class names prefixed per-game, e.g. `otb-`, `wb-`). Every content-based game (unscramble, spin-the-wheel, open-the-boxes) follows the same internal shape: a `view` state machine (`loading | list | form | play | notfound | error`), a parse-textarea-into-lines content model with optional `.txt` import, save/delete/share-link actions against its own `STORAGE_KEY`, and a `persistSets`-style optimistic local update + fire-and-forget remote save with a transient error flash on failure. When touching one of these games, check the others for the established pattern before inventing a new one.

**Whiteboard is the exception:** `src/games/whiteboard/Whiteboard.jsx` is a freeform canvas (pan/zoom, draggable/resizable rich-text boxes) rather than a set-based game, keyed by student roster instead of named sets. Rich text is `contentEditable` + `document.execCommand`, with inline HTML persisted directly (`box.html`). `migrateBoxToHtml()` upgrades older saved shapes (whole-note bold/fontSize flags, or plain text) to the current inline-HTML format on load — preserve this when changing the box data shape.

## Design system

Full color tokens, typography, and tone are specified in `project-spec.md`. Tokens live in `src/styles/tokens.css`; global resets/layout in `src/styles/global.css`. Stick to the existing CSS custom properties rather than hardcoding colors, so both themes and both palettes stay consistent.
