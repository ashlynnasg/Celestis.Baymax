# Architecture

```
Expo app (port 8081)
  app/_layout.tsx  → OwnerGate → AppProvider → Stack
  screens (Expo Router)  ── tRPC ──▶  Express API (port 3000)
                                        │
                          server/assessment.ts  (single assessment service)
                                        │
                          shared/screening.ts   (pure, deterministic rules)
                                        │
                                  Drizzle ORM → local SQLite (node:sqlite)
```

## Why one shared service

Every surface that shows a conclusion — dashboard, domain detail, mission table, assistant answers,
care plan, case timelines, simulator comparison, exports and the CSV/JSON importer preview — calls the
same `buildBundle`/`assessDomain` path in `server/assessment.ts`. No screen re-implements a threshold,
so a category can never disagree with itself between two tabs.

`buildBundle` returns:

- `crew`, `mission` (applied configuration), `stream` (baseline or a simulation run)
- `domains[]` — full explainable assessment per domain (category, evidence, facts, gaps, uncertainty,
  rule ids, assumptions, prevention, next check, references, freshness, completeness, baselines)
- `overallCategory`, `nextStep`, `dataGaps`, `completeness`, `assessedAt`, `ruleSetVersion`, `timezoneLabel`

## Pure vs stateful

| Layer | Responsibility |
| --- | --- |
| `shared/screening.ts` | Pure rule evaluation: inputs in, explainable result out. No I/O, no clock beyond the passed timestamp. |
| `shared/care.ts` | Prevention/treatment-support content derived from an assessment. |
| `shared/assistant.ts` | Intent detection and templated explanation over an assessment bundle. |
| `shared/simulator.ts` | Seeded, deterministic scenario generation (seven days, seven metrics). |
| `shared/handover.ts` | Handover status machine, allowed transitions, leg timing. |
| `shared/importing.ts` | CSV/JSON parsing, column suggestion, unit conversion, validation, CSV building. |
| `server/db.ts` | Persistence helpers; all timestamps stored as UTC `Date`. |
| `server/assessment.ts` | Loads data, calls the pure engine, persists case events for real category changes. |
| `server/routers/*` | Validation (zod in `server/validation.ts`), authorization, orchestration. |

## Case synchronisation

`syncCasesForCrew` runs after each write and at startup (`syncAllCrewCases`). It compares the newly
assessed category for each domain against the open case for that crew/domain/stream:

- worse category → open or update a case, append a dated `category_change` event
- better category → append an improvement event, keep evidence
- no change → nothing is written (viewing or refreshing never creates events)

## Owner authorization

`createOwnerGate()` in `server/owner-auth.ts` is mounted in front of `/api/trpc` and rejects any
procedure other than `owner.*`/`system.*` without a valid bearer token whose hash matches a live,
unexpired, unrevoked session. The client attaches that token from `lib/owner-token.ts`.

## Client state

- `lib/app-context.tsx` — selected astronaut (persisted), crew list, mission/applied names, active stream, metadata.
- React Query caches per tRPC procedure; writes call `utils.invalidate()` so every surface recalculates.
- Assistant threads are keyed by `crewId | streamId | missionId`, so a context change starts a clean thread.


## Evidence edition 1.1.0

shared/references.ts is the offline source catalogue. shared/mission-context.ts owns input validation, scientific domain mappings and coverage calculations. shared/screening.ts attaches this material to the existing shared assessment, without changing numeric thresholds. Future observations are excluded until their observation time is reached.

server/mission-log-store.ts persists validated JSON records using parameterized SQLite statements in atomic transactions. The additive missionLogs table is defined in both drizzle/schema.ts and the rerunnable bootstrap. server/routers/evidence.router.ts exposes owner-protected save/history/import/export endpoints. Case notes and frozen handover snapshots carry the resulting evidence.

Normal startup uses scripts/start-local.mjs: a loopback-only API on 3000 and static web export on 8081. It checks ports, waits for initialized API data, serves packaged assets and supports direct client-route reloads. Metro (npm run dev) is for development. Source edits require a new backend/frontend build for npm start.

Coverage states are separate from clinical categories. Scope is crew + stream + applied mission. Historical context is stored but is not reused automatically for a newly applied mission. Replay builds filter context by their assessment clock and never update live context records.
