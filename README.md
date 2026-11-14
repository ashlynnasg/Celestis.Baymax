# Celestial Baymax — Manus app, Windows / SQLite edition

Celestial Baymax is a fictional, offline-first style crew health-monitoring demonstration for the
NASA Space Apps Challenge brief *"Can you design a health-monitoring system for astronauts?"*
(tagline: **Predict. Prevent. Protect. Recover.**). It runs as a portrait Expo / React Native app
with the supplied Manus Expo Router interface, a tRPC API and a local SQLite database.
The ready-to-run browser build and full editable source are both included.

Every astronaut, observation, mission, case and ground reply in this build is fictional or clearly
labelled simulated data. The app is not a medical device, does not give medical advice, does not
predict disease and is not endorsed by NASA or the Canadian Space Agency.

## What the app does

The app follows one record through a connected workflow. A persistent context bar shows the selected
astronaut, the active baseline or simulated stream and the applied mission on every screen.

| Area | Behaviour |
| --- | --- |
| Overview | Astronaut card with a one-tap crew switcher, one prominent next step, five-hazard coverage, seven vital cards with units, time, source and freshness, eight screening domains, body-map navigation and data gaps. |
| Crew | Create, edit, search, archive and restore profiles with a full medical history; crew-wide list sorted worst-first. |
| Review | One explainable screening engine for eight domains and four canonical categories: Priority Review, Review Before Assignment, More Data Needed, No Demo Flags. |
| Mission | Draft vs applied mission configuration, an honest influence list, hazard coverage and an all-crew readiness table. |
| More | Mission context & radiation, evidence library, assistant, guided checks, case timelines, simulator, data integration, Deep Space Link and settings. |
| Deep Space Link | Local handover state machine: Draft → Queued → Sent → Delivered → Reply in transit → Reply received, with a virtual clock, link outage, frozen evidence snapshots and a fictional ground reply. |
| Simulator | Six documented scenarios, saved runs and read-only replay; the baseline is never modified. |
| Data integration | CSV/JSON importer with mapping, validation, duplicates, row errors and a downloadable report; a separate adapter for context, radiation and cabin records. |
| Settings | Owner session, rule-set versions, CSV/JSON exports, **portable SQLite backup** and the explicit demonstration reset. |

### Traceability rules

Every concern shows the chain *recorded observation → spaceflight relevance → exact demonstration
rule → uncertainty → next action → source*. Rule IDs, assumptions and gaps are visible in the
assessment screens, the assistant, the mission table, cases and exports.

- Missing data stays unknown and never becomes a reassuring result; an explicit zero stays distinct
  from a blank value.
- Hazard coverage (`Not assessed`, `Older records`, `Partial records`) is independent of the four
  medical categories and never reads as "safe" or "cleared".
- Radiation values keep their original quantity and unit (Gy/mGy/uGy vs Sv/mSv/uSv). The app performs
  no conversions, totals, cancer-probability estimates or safe-limit comparisons.

## Windows: setup once, then start

1. Extract **the whole ZIP** into a new folder, for example `C:\Projects\CelestialBaymax`.
   Keep it outside OneDrive/network drives and do not run from inside the ZIP.
2. Double-click **setup_windows.cmd**. It uses a compatible installed Node.js or downloads a
   checksum-verified official Node.js 24 LTS into this folder. Administrator access is not needed.
   Internet is needed only if Node.js must be downloaded.
3. Double-click **start_windows.cmd**. The browser opens **http://127.0.0.1:8081** after SQLite
   and the API are ready. Keep the terminal open. Press **Ctrl+C** to stop.
4. Create your own local owner passphrase on first use. There is no default password.

Normal setup/start needs **no Python, MySQL server, SQLite installation, npm install or paid API**.
The packaged JavaScript runs directly on Node.js. A supported 64-bit Windows laptop and a modern
browser are required. Node.js 24 LTS is recommended; Node.js 22.16+ is also supported.

Data is created in `data/celestial-baymax.sqlite`. Repeating Setup or Start keeps your records and
owner account. The supplied ZIP has no account, session, real medical record or pre-existing database.
The first setup seeds six fictional profiles. This local database is separate from the database
in your hosted Manus app: converting the connection does **not** transfer hosted records.

For another computer, close the app before copying the whole `data` folder. The Settings SQLite
export intentionally excludes accounts and is a records export, not a full installation restore.
Do not delete `data` to repair installation problems. There is an explicit reset action inside the app.

### Troubleshooting

- **Download blocked:** install Node.js 24 LTS from https://nodejs.org, then run Setup again.
- **Port in use:** close an earlier Baymax terminal or the app using port 3000/8081, then retry.
- **Browser did not open:** open http://127.0.0.1:8081 manually after the terminal says ready.
- **Missing file:** extract the entire ZIP; do not move the CMD files out of the project folder.
- **Access denied/database locked:** use a writable local folder, close other copies of the app
  and avoid synchronized folders. Do not run two copies against the same data directory.
- **Windows blocks scripts:** the launchers invoke Windows PowerShell with process-only execution
  policy bypass. Organization policy may still block scripts; your administrator must resolve that.

### Editing and rebuilding the source

The supplied browser/API builds preserve the Manus UI. After changing source, close the app and
run **rebuild_windows.cmd**, then Start. Rebuild installs pinned development dependencies, checks
TypeScript, runs tests and regenerates the browser/API bundles. It needs internet, npm/npx (included
with the full Node.js distribution) and more time than normal startup. It never resets `data`.

Developer terminal commands, from the project folder:

```bash
npx --yes pnpm@9.12.0 install --frozen-lockfile
npx --yes pnpm@9.12.0 check
npx --yes pnpm@9.12.0 test
npx --yes pnpm@9.12.0 build
node scripts/start-local.mjs
```

For live development use `pnpm dev`. `pnpm db:init` (or `pnpm db:push`, retained as a compatibility
alias) initializes the local database without dropping records. Set `BAYMAX_DB_PATH` before startup
only if a different SQLite location is needed. `DATABASE_URL` is not used by this local edition.

## Portable SQLite backup

Settings → **Download SQLite backup** produces a real `.sqlite` database built with Node's built-in
`node:sqlite`. It contains the thirteen demonstration tables (`crewProfiles`, `observations`,
`missionPlans`, `appState`, `simulationRuns`, `cases`, `caseEvents`, `guidedChecks`, `handovers`,
`handoverEvents`, `groundReplies`, `importBatches`, `missionLogs`) with the original Drizzle table and
column names, plus a `_backup_meta` table recording the format, generation time and the note that it
holds fictional records only. Timestamps are UTC epoch milliseconds.

Open the file with DB Browser for SQLite, `sqlite3`, Drizzle Studio or any SQLite-compatible tool. The
backup never includes the owner passphrase, its scrypt hash, session tokens or account rows. If a
runtime has no `node:sqlite` module, the same action downloads an equivalent `.sql` dump that
recreates the database with `sqlite3 celestial-baymax.sqlite < backup.sql`. WAL/SHM sidecar files are
not produced or required for this export.

## Architecture

```
app/                 Expo Router screens (tabs + detail routes)
components/          UI primitives and domain blocks (app-shell, app-blocks, science, charts)
lib/                 tRPC client, app context, file helpers, platform alert wrapper, design tokens
shared/              Pure domain logic: screening, care, assistant, simulator, handover, importing,
                     mission-context, references, formatting and types
server/              tRPC routers, assessment service, SQLite storage, owner auth and exports
scripts/             Windows setup/start, portable local server and source build
dist/, web-dist/     Ready-to-run API and browser builds (no dependency installation to launch)
drizzle/             SQLite schema and optional developer configuration
docs/                Rules & limitations, data dictionary, evidence upgrade, demo script, test report
tests/               Vitest suites (starter CORS/logout plus domain rule tests)
```

The same `shared/screening.ts` engine feeds the dashboard, assistant, mission table, care support,
cases and exports, so a category can always be traced back to one rule set
(`demo-rules-1.1.0-evidence`).

## Known limitations

- No sensors or wearables; every value is entered, imported or generated as labelled simulated data.
- No diagnosis, prescribing, dosing, clearance or replacement of medical personnel.
- No network transmission of real messages; Deep Space Link is a local simulation.
- Clinical thresholds are demonstration engineering settings; NASA/CSA sources support why monitoring
  matters, not the numeric cutoffs. Clinical approval is tracked separately and remains unsupplied.
- The owner gate is a prototype authentication system (scrypt + hashed expiring tokens), not an
  audited clinical authentication product; the database is not encrypted at rest.

See `docs/RULES_AND_LIMITATIONS.md`, `docs/EVIDENCE_UPGRADE.md`, `docs/DATA_DICTIONARY.md` and
`docs/REFERENCES.md` for the full evidence and rules discussion.
