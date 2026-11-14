# Celestial Baymax — Mobile App Plan (Manus Mobile Dev)

Source baseline: `Celestial_Baymax_Evidence_Windows` v1.1.0 (Expo Router / React Native / TypeScript,
Express + tRPC, Drizzle, node:sqlite, shared deterministic screening engine).
Target: a **managed Manus Mobile app** (Expo + tRPC + managed MySQL) that carries the product,
domain logic and evidence model of the source into a portrait, one-handed mobile experience.

## 1. Audit of the supplied source

### What already works (read from source, not claimed as re-run results)
- 12 product areas are implemented: Overview, Crew profiles, 8-domain screening, care support,
  Mission readiness (draft/applied), local assistant, 6-scenario simulator, data integration,
  mission context/radiation/cabin + 5-hazard coverage, NASA/CSA evidence library, Deep Space Link
  handover, continuing cases + guided checks.
- A single shared engine (`shared/screening.ts`, ~62 KB) feeds dashboard, assistant, mission table,
  care, cases, simulator and exports; four canonical categories with fixed order.
- Evidence model: `shared/references.ts` catalogue (stable IDs, supported claim, limitation,
  content kind, source-check date) plus hazard tags and threshold provenance per domain.
- Radiation/cabin/context records live in one additive `missionLogs` table with validated typed
  payloads, fingerprint duplicate protection and 72-hour coverage freshness.
- Owner passphrase auth (scrypt hash + expiring bearer sessions), idempotent seeding, six fictional
  profiles, CSV/JSON importers with preview/commit, frozen handover snapshots.
- UI already uses React Native StyleSheet + a dark violet/rose theme (`shared/constants.ts COLORS`).

### Weak points found
1. **Desktop-shaped layout.** Several screens assume a laptop: the mission readiness table, wide
   two-column panels, small 10–11 px medical text, body map sized for a wide canvas, long single-page
   context form. This is the main work for a mobile deliverable.
2. **SQLite-only persistence** (`node:sqlite` + `sqlite-bootstrap.sql`). Managed Mobile cannot keep a
   local file database (ephemeral server filesystem), so the schema and adapters must be ported.
3. **Windows-only delivery machinery** (launchers, `dist/`, `web-dist/`, portable Node bootstrap) is
   irrelevant to a mobile app and must not be carried over.
4. Assistant, import and handover screens are text-dense; on a phone they need progressive disclosure.
5. Small but real issues: body-map SVG responder warning; no in-app reduced-motion switch; no global
   "next action" affordance on smaller widths; import picker relies on a browser file input.

### Agency resources verified today
The five supplied pages load and match their summaries: NASA Five Hazards (radiation, isolation and
confinement, distance from Earth, gravity fields, hostile/closed environments; hazards interact),
NASA Risks of Human Spaceflight (physiology / behavioral / radiation risk list, destination-dependent),
CSA CANS article (continuous autonomous neutron measurement, ~30 % of ISS radiation, no readings
supplied), plus the NASA sleep, bone, fitness, cardiovascular, SANS, behavioral-health and Standard
Measures reference pages already in the catalogue. None supplies individual records, validated
cutoffs, cancer probabilities or approved protocols; the app keeps them as background only.

## 2. Genuine architecture change to approve

| Source v1.1.0 | Mobile deliverable | Reason |
| --- | --- | --- |
| `node:sqlite` file in `data/`, bootstrap SQL | Managed MySQL through Drizzle (`mysql2`) | Mobile server filesystems are temporary; the platform supplies managed MySQL only. |
| Owner session via bearer token + local file DB | Same owner model: passphrase setup, scrypt hash, expiring server sessions, bearer token in AsyncStorage/SecureStore | Keeps "no default password", hashing, logout, backend-protected APIs. |
| Windows launchers, compiled `dist/`, `web-dist/` | Expo Go / web Preview; Dashboard builds APK/AAB | Mobile delivery surface. |
| Browser file input for CSV/JSON | `expo-document-picker` + shared parser | Same validation, atomic commit, duplicate protection. |

Not changed: screening rules and thresholds (`demo-rules-1.1.0-evidence`), four categories and
order, hazard states (`Not assessed` / `Older records` / `Partial records`), six scenarios, handover
state machine, reference catalogue, assistant logic, radiation quantity/unit/scope safeguards,
unknown-vs-zero semantics, fictional-data-only stance. All 16 tables keep their names and columns so
the data dictionary still describes the model; timestamps stay epoch-milliseconds integers.

## 3. Implementation approach

- **Server**: starter Express/tRPC kept. `drizzle/schema.ts` rewritten as MySQL tables (ids
  `varchar(64)`, JSON payloads `text`, numbers `int`/`double`, timestamps `bigint` ms, booleans
  `boolean`, indexes preserved). `server/db.ts` ported to `drizzle-orm/mysql2` (only two raw `sql`
  fragments, both MySQL-compatible; no `.returning()` usage). `owner-auth.ts`, `assessment.ts`,
  `mission-log-store.ts`, `validation.ts`, `seed.ts` and all routers copied with import-path fixes.
- **Idempotent preparation**: `db:push` (drizzle generate + migrate) then a seed runner guarded by
  `appState.seedVersion`, so repeated startup never duplicates profiles or overwrites user edits.
- **Shared**: `shared/*` copied verbatim (screening, references, assistant, simulator, handover,
  care, importing, context-import, mission-context, domain, constants, format) — one engine for
  every surface.
- **Client**: starter tRPC/React Query/provider stack; source `lib/ui.tsx`, `components/app-blocks.tsx`,
  `components/science.tsx`, charts, `app-context`, `owner-gate` reused, then reflowed for portrait.
- **Auth guard**: `protectedProcedure` validates the bearer session for every data router;
  `owner.*` setup/login/status stay public. Web preview uses the same bearer token.
- **Navigation** (5 tabs, stack for depth):
  `Overview` · `Crew` · `Review` · `Mission` · `More`, with stack routes for crew detail/edit,
  new observation, assessment/domain, care/domain, guided check, case detail, assistant, simulator
  run, handover detail, evidence, mission context & radiation, import, settings.
  A persistent context bar shows astronaut · stream · applied mission; "All crew" is explicit.
- **Mobile UX**: one prominent next-action card; compact category cards sorted worst-first; charts
  with empty/one-point/multi-point states plus table alternative; progressive context form in four
  short steps; mission readiness as sortable crew cards instead of a table; handover timeline with
  two delay legs and hidden reply until the return leg completes; import wizard (pick file → map/
  preview → commit) with per-row errors.

## 4. Project structure

```
app/                 Expo Router screens (tabs + stack), one file per screen
components/          reusable RN blocks (app-blocks, science, charts, owner-gate, crew editor)
lib/                 trpc client, app context, UI kit, owner token store
shared/              deterministic domain: constants, screening, references, assistant, simulator,
                     handover, care, importing, context-import, mission-context, domain, format
server/              _core (express/trpc/env), db.ts, owner-auth.ts, assessment.ts, seed.ts,
                     mission-log-store.ts, validation.ts, routers/*.ts
drizzle/             mysql schema + generated additive migrations
tests/               vitest unit tests for shared engine + validators
docs/                rules & limitations, data dictionary, references, demo script
```

## 5. Milestones and acceptance criteria

**M1 — Port + boot.** MySQL schema, ported server, idempotent seed, owner setup/login, tRPC client
with bearer token; app opens on Overview with six fictional profiles; `pnpm check` clean.

**M2 — Overview, Crew, observations.** Context bar (astronaut · stream · mission); next-action card;
vital cards showing value/unit/time/source/freshness with Unknown ≠ 0; charts for 0/1/n points with
gaps; body map + text list for eight domains; crew create/edit/search/archive with cross-section
validation and preserved values between tabs.

**M3 — Screening, care, cases, checks.** Assessment detail shows concern, category, evidence with
units/dates/source, plain-English explanation, rule IDs, assumptions, gaps, uncertainty, prevention,
follow-up, sources; identical results in assistant/mission/cases/exports; guided checks select a
missing or stale input, accept "unable to record" with reason and update case + assessment;
"Arrange priority review" reaches the real review/escalation path.

**M4 — Mission, context, radiation, evidence.** Draft vs Applied mission with honest influence list;
five-hazard coverage independent of the four categories; context form in steps; radiation records with
quantity/unit/scope/interval validation and simulated labels; cabin records; evidence library with
claims, limits, content kind and check dates.

**M5 — Assistant, simulator, handover, import.** Deterministic assistant covering the listed intents
with limitation disclosure and contextual actions; six scenarios saved as separate streams with
read-only replay and day slider; Deep Space Link Draft→Queued→Sent→Delivered→Reply in transit→Reply
received with frozen snapshot, outage handling and virtual clock; CSV/JSON import with preview,
errors, duplicates and atomic commit.

**M6 — Polish + verify.** Portrait screenshots at 375×812 for each main screen, contrast and text
size fixes, reduced-motion support, empty/loading/error states, keyboard/focus behaviour; unit tests;
checkpoint; docs (rules, data dictionary, demo script) updated to the mobile build.

## 6. Design direction (reusing the approved hybrid theme)

- **Design Movement**: "Mission-control nocturne" — instrument-panel calm of aerospace consoles
  rendered with soft, rounded mobile surfaces.
- **Core Principles**: evidence before interpretation; one next action per screen; the selected
  astronaut/stream/mission never disappears; colour is semantic, never decorative for status.
- **Colour Philosophy**: deep navy (#0C1426) and slate panels hold attention in low light; violet
  (#8655E8) is the brand's instrument glow, rose (#F779A5) its human accent; bright reading panels
  (#F7F9FE) appear only where a value must be read precisely; red/amber/neutral/green stay reserved
  for review categories.
- **Layout Paradigm**: a vertical "flight strip" — persistent context bar, then a single dominant
  action card, then collapsible evidence blocks. No dashboard grid; one-handed reach keeps primary
  actions in the lower third.
- **Signature Elements**: the crescent-orbit mark; the stream ribbon ("Baseline" vs "Simulated");
  category pills that pair icon + text with colour.
- **Interaction Philosophy**: every tap reveals provenance, never hides it; destructive or
  irreversible steps (archive, commit import, queue handover) confirm with the consequence stated.
- **Animation**: 150–220 ms ease-out on mount and expansion only; no looping glow; respects
  Reduce Motion by dropping transforms to opacity.
- **Typography System**: system sans (SF Pro / Roboto) — 22/700 titles, 15/400 body, 13/500 labels,
  11/600 uppercase micro-labels; numbers tabular and at least 20 px.
- **Brand Essence**: a calm, honest space-medicine companion for a fictional crew — *protective,
  precise, transparent*.
- **Brand Voice**: clinical but human. "Sleep is 4.2 h short of the review floor — record last
  night before assignment." / "This is a demo rule, not a flight clearance."
- **Wordmark & Logo**: crescent bay holding a violet orbit ring and a rose pulse dot; native icon
  regenerated from the same mark.
- **Signature Brand Colour**: violet-orbit #8655E8.

## 7. Scope boundaries

Delivered: the mobile app, its backend, schema, seeds, tests, docs. Not delivered here: Windows
launchers/portable Node (platform-specific to the laptop build), native release binaries (Dashboard
build action), real agency datasets or clinical validation, any disease probability or clearance.

## Delivered additions (approved during implementation)
- **Portable SQLite backup** (user request): Settings → *Download SQLite backup* builds a real SQLite
  database with `node:sqlite` from the thirteen demonstration tables, using the original Drizzle table
  and column names, and adds a `_backup_meta` table with format, generation time and a
  "fictional records only" note. Account tables (`users`, `owners`, `ownerSessions`) are excluded.
  A `.sql` dump fallback covers runtimes without the SQLite module. Verified: 13 tables, 191 rows,
  opens cleanly in `sqlite3`/`node:sqlite`.
- **Reduced motion**: `lib/motion.ts` tracks the platform setting; `MotionSpinner` replaces the loading
  spinner with a static status label when Reduce Motion is on. No looping or transform animations ship.
- **Type scale**: captions are 12 px, field hints and multi-line explanations 13 px, body 15 px.
