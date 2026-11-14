> Historical planning/build notes from the supplied app. For version 1.1.0, use README.md, docs/EVIDENCE_UPGRADE.md and docs/TEST_REPORT.md.

> Historical notes from the original Manus/MySQL version. SQLite Windows conversion is described in root README.md; the converted app needs Windows browser verification.

# Celestial Baymax — build progress (working notes)

## Done
- Expo starter kept (Expo Router + tRPC + Drizzle/MySQL).
- Shared engine modules: `shared/constants.ts`, `shared/domain.ts`, `shared/screening.ts`,
  `shared/care.ts`, `shared/assistant.ts`, `shared/simulator.ts`, `shared/handover.ts`,
  `shared/importing.ts`, `shared/format.ts`.
- Database schema (13 tables incl. crew, observations, missions, app state, simulation runs,
  cases, case events, guided checks, handovers, handover events, ground replies, import batches)
  → `drizzle/0001_fixed_talon.sql` applied with `pnpm db:push`.
- Server: `server/db.ts`, `server/assessment.ts` (single shared assessment service + case sync),
  `server/seed.ts` (6 fictional crew, done via explicit ids crew-01..crew-06), `server/validation.ts`,
  routers: crew, observation, assessment, mission, cases, checks, assistant, simulator, imports, link,
  state, exports. Composed in `server/routers.ts` (`mission.applyDraft` because `apply` is reserved).
- Seed runs at API startup (`prepareData`), reset via `state.resetDemo` with literal `"RESET DEMO"`.
- Env: platform env copied into gitignored `.env` (non-personal) and `.env.local` (EXPO_*/REACT_NATIVE_*),
  because the resident dev server did not inherit the tool wrapper env.
- UI: `lib/ui.tsx` primitives, `lib/app-context.tsx` (crew selection + AsyncStorage),
  `lib/files.ts` (DocumentPicker/File/Sharing/Clipboard), `components/app-blocks.tsx`,
  `components/crew-editor.tsx`, charts (`metric-chart.tsx`, `comparison-chart.tsx`).
- Screens: tabs overview/crew/review/mission/more, crew detail + new/edit, observation entry,
  assessment domain, care domain, guided check, cases list/detail, assistant, simulator list/replay,
  import, link list/detail.
- `npx tsc --noEmit` clean at last check.

## Completed after these notes
- `app/settings.tsx` (rules, exports, reset, owner session, limitations).
- Owner access: `owners`/`ownerSessions` tables, `server/owner-auth.ts` (scrypt + hashed 12h sessions),
  `/api/trpc` middleware gate, `components/owner-gate.tsx` setup/sign-in screen, `lib/owner-token.ts`
  (the starter auth helper deliberately ignores tokens on web, so the app keeps its own store).
- `app/_layout.tsx` wraps `OwnerGate` → `AppProvider` → `Stack`; screens use the plum background.
- Docs: README, RULES_AND_LIMITATIONS, DATA_AND_PRIVACY, ARCHITECTURE, TEST_REPORT, DEMO_SCRIPT,
  KNOWN_ISSUES; `examples/` import files; `app.config.ts` logo + sharing/document-picker plugins.
- Verified: tsc clean, Metro web bundle 200, API flows (simulator, checks, import, handover), owner gate
  401 for anonymous reads. Demo owner rows deleted so the app opens on first-run setup.
- Checkpoint pushed to `origin/main` (`83bf673`).

## Publishing
`publishing.auto_publish` is `false` and no container/build declaration is configured, so nothing was
published. Preview (Expo web + Expo Go QR) is the delivered surface. A container publish would need a
Dockerfile that runs the Express API and serves the Expo web export, plus hybrid routes.
