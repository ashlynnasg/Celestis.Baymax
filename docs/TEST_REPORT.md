# Verification report — evidence edition 1.1.0

Date: 14 November 2026. Environment: Linux execution workspace, Node 24.22.1, pnpm 10.30.3, Expo 57.0.24, React Native 0.86.3, TypeScript 6.0.3. No native Windows execution was available.

## Reproducible dependency check

`CI=true npx --yes pnpm@10.30.3 install --frozen-lockfile --ignore-scripts` completed successfully against the shipped lockfile. The final checks and builds below used those locked versions. An earlier npm installation was not used as the final version check. Initial dependency downloads require internet; application operation is local after setup.

## Automated suite

`npm run check`: passed, no TypeScript errors.

`npm test`: **42 passed; 1 skipped** across the SQLite bootstrap, local CORS and evidence workflow suites. The skipped test is an unused starter Manus cookie-logout test. Actual local-owner setup, login, logout and session persistence are separately exercised over HTTP.

Coverage includes:

- The five supplied resources, correct bone source, removal of an unverified WHO attribution and explicit threshold boundaries.
- All eight domain mappings; optional context does not alter clinical review category.
- Exposure quantity/unit validation, explicit zero versus missing, negative values, intervals, timezone/future times and empty cabin records.
- Radiation absence, stale records and crew/mission/stream separation.
- Parameterized persistence, rerunnable schema initialization, duplicate protection and atomic rollback.
- Idempotent case notes for saved evidence.
- Real CSV/JSON preview/commit, invalid mixed batches, identity mismatch, unsupported columns and changed-preview rejection.
- Record-based assistant explanations and source boundaries.
- Frozen handover evidence, independent provenance, future clinical observation exclusion and cross-crew case rejection.
- Existing loopback CORS and SQLite owner-data preservation checks.

## Builds

- `npm run build`: passed; packaged API is dist/index.mjs.
- `npm run build:web`: passed; 32 static Expo routes and browser JS/CSS/assets exported to web-dist.

## HTTP integration

`npm run test:http`: **13 workflow checks passed** using its own disposable SQLite database. It does not touch the application data folder and does not ship a QA account.

1. Packaged web shell.
2. Static assets and direct client-route reload shells.
3. Owner gate on evidence endpoints, with readable tRPC authorization errors.
4. First-run account, real sign-in and six fictional seed profiles.
5. Exposure save/deduplication with unchanged clinical category.
6. CSV preview and atomic commit.
7. Assistant response uses the selected exposure record.
8. Queue-time evidence freeze during simulated outage; changes between draft and queue are included.
9. Separate outbound/return legs; reply text remains hidden until arrival.
10. Virtual communication clock does not alter observation timestamps.
11. Export includes source metadata and reference catalogue.
12. Owner session and evidence persist across server restart.
13. Logout revokes backend access.

## Limits of this verification

Native Windows setup/start/test commands were not executed in this Linux workspace. The remote browser could not reach the isolated application server, and a local browser binary was unavailable. Consequently, no complete interactive visual review, native-device build, keyboard/zoom/contrast audit, or browser file-picker interaction is claimed. The static web build, assets, direct reload routes and live API were checked as described above. Run test_windows.cmd with other Baymax instances closed, and perform the short UI walkthrough on the team's Windows laptops.

These are software checks, not medical validation, radiation dosimetry validation or NASA approval. The reference summaries do not validate numeric demo cutoffs. Future dataset/model integration remains a separate reviewed task.


## Archive rehearsal

The ZIP was integrity-checked and extracted into a Linux path containing spaces and parentheses: package rehearsal/Celestial Baymax (1)/Celestial_Baymax_Evidence_Windows. The exact shipped code and builds were used with a link to the frozen dependency installation. Database initialization was run twice (16 tables, no reset), then all 13 HTTP workflow checks passed again from that extracted folder. This confirms path handling in the Node launch/build assets; it is not a native Windows or PowerShell test.

The deliverable excludes node_modules, runtime downloads, environment files, personal databases, QA accounts and private helper files. It includes source, dependency lockfile, backend/browser builds, Windows setup/start/test launchers, example files and this report.
