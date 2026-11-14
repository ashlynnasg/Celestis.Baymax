# Celestial Baymax — Mobile App TODO

Approved plan: `plan.md` (managed MySQL + portrait mobile reflow + SQLite-compatible backup).

## 1. Ported data layer, owner access and seeding — DONE
- [x] 16 tables ported to MySQL with unchanged names/columns; epoch-ms domain timestamps; additive drizzle migration `0001_easy_stick.sql` applied; 16 tables verified in the managed database.
- [x] Idempotent seed verified: six fictional profiles (Amara, Diego, Kenji, Lars, Maya, Priya), 163 observations, one applied mission and six continuing cases; repeated starts do not duplicate.
- [x] Owner setup with no default password, scrypt-hashed passphrase, server-validated expiring sessions (12 h), logout, and an Express owner gate on every non-owner/system tRPC procedure.
- [x] Health/readiness endpoints report seed state (`/api/ready` → `{"ok":true,"seedVersion":"seed-1.0.0"}`).

## 2. Overview, context bar and observations — DONE
- [x] Persistent context bar on every tab: astronaut · stream · applied mission, tap to switch.
- [x] Astronaut card with horizontal one-row crew switcher, completeness line and category pill.
- [x] One prominent next-action card with a working "Open case timeline" action and "Start useful check".
- [x] Seven vital cards show value, units, original date/time, source and freshness; missing values read "Unknown / not recorded"; zero stays distinct.
- [x] Charts show newest observation by default, a single-observation label, gaps without invented values, and a selectable table alternative.
- [x] Body map is decorative navigation; labelled domain buttons carry the interaction (no SVG responder warnings).

## 3. Crew medical profiles — DONE
- [x] Create, edit, search, include-archived, view and archive/restore; cards open the profile and expose a separate "Select astronaut" control (no nested buttons).
- [x] Full medical history sections and cross-tab validation retained from the evidence edition.

## 4. Shared explainable screening — DONE
- [x] Eight domains, four canonical categories in rank order; same `shared/screening.ts` engine feeds dashboard, assistant, mission table, care, cases and exports.
- [x] Observation → relevance → rule → uncertainty → next action → source chain; rule IDs and assumptions visible.
- [x] Unknown data never yields No Demo Flags (unit test `screening: unknown data is never a reassuring result`).

## 5. Guided checks, care support and recovery — DONE
- [x] Guided checks, inability-to-record reasons, care support and review escalation retained and reachable from Overview, Review and domain screens.

## 6. Mission readiness, context, radiation, cabin and hazard coverage — DONE
- [x] Draft vs applied mission with honest influence list; Apply recalculates every screen.
- [x] Five-hazard coverage states independent of medical categories; never "safe"/"cleared".
- [x] Context/radiation/cabin records with original units and scope; absorbed dose vs dose equivalent kept separate.
- [x] Radiation schema now rejects a unit from the wrong family (new test).

## 7. Assistant, simulator, Deep Space Link and cases — DONE
- [x] Deterministic local assistant with disclosure, starter questions and six-part answers (verified live, ~10 s per answer).
- [x] Six scenarios, saved runs, read-only replay; baseline untouched.
- [x] Link state machine, virtual clock, outage, frozen snapshots and hidden-until-return reply; transition tests added.

## 8. Data integration and SQLite-compatible backup — DONE
- [x] CSV/JSON importer with mapping, validation, duplicates and downloadable report (valid example parsed and previewed live).
- [x] Explicit context/radiation/cabin adapter.
- [x] **SQLite-compatible backup**: Settings → Download SQLite backup returns a real `.sqlite` file (verified: SQLite 3.x, 13 tables, 191 rows, `_backup_meta`), with `.sql` dump fallback; excludes accounts, passphrase hashes and session tokens; documented in README and docs.

## 9. Mobile UX, evidence library and accessibility — DONE
- [x] Portrait layout checked at 375×812 in a phone-sized frame on every major screen; context bar, single-row crew strip, readable 11 px minimum labels, semantic colours with text.
- [x] Platform-aware alert wrapper so confirmations (apply, archive, reset, discard) work on web instead of being silently dropped.
- [x] Evidence library unchanged and reachable from More, hazards and domain screens.

## 10. Verification and documentation — DONE
- [x] `pnpm check` clean; `pnpm test` → 37 passed, 1 skipped (starter CORS/logout plus new domain rule tests).
- [x] README, rules & limitations and data/privacy docs updated for the mobile/MySQL build and the SQLite backup.
- [x] Checkpoint committed to `origin/main`.

### Honest gaps
- Native iOS/Android binaries were not built here; the app was verified in the Expo web runtime inside a phone-sized frame.
- Clinical approval remains unsupplied by design; thresholds are demonstration settings.
