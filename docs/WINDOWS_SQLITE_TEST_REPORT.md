# Windows / SQLite edition — verification

Verified on 14 November 2026 using Node.js 24.22.1 in a Linux workspace.

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Passed |
| Existing CORS tests | 25 passed |
| Existing domain rules/import validation tests | 12 passed |
| Added SQLite compatibility tests | 9 passed |
| Original starter OAuth logout placeholder | 1 skipped, unchanged from supplied source |
| Production API bundles | Built successfully; all JavaScript dependencies bundled |
| Expo static browser export | Built successfully; 32 route entries |
| Portable release HTTP checks | 25 passed |
| Frozen dependency lockfile | Validated with `pnpm install --frozen-lockfile --offline --ignore-scripts` |
| Supplied UI, assets and shared domain logic | 85 files compared byte-for-byte with the Manus ZIP; no changes |

The SQLite tests verify initialization, idempotent demo seeding, profile changes, boolean mapping,
Date/session mapping, owner login/logout, SQLite upserts, concurrent evidence deduplication,
transaction rollback isolation, CSV/JSON preview and commit, simulation/baseline separation,
screening output, and credential-free binary SQLite exports.

The release test copies only the compiled API, static web build and Node launcher to a disposable
folder containing spaces. It has no node_modules, package manager or database server. It runs
database setup, starts the app, checks exact local CORS and authorization, saves a profile, gets an
assessment and assistant explanation, downloads a real SQLite backup, serves browser routes and
JavaScript, rejects missing assets, restarts the app, verifies persistence and revoked sessions,
and checks database integrity. No test account or test database is included in the delivered ZIP.

## Platform limitation

Native Windows CMD/Windows PowerShell execution and the Windows Node download could not be run
inside this Linux workspace. The launchers use Windows PowerShell 5.1-compatible syntax, quoted
paths, CRLF line endings and a file-based runtime probe that avoids inline JavaScript quoting.
The included Node server and SQLite runtime were exercised as described above. Automatic browser
opening, Windows organization policy and the official Node download still need checking on the
target Windows laptop.

To repeat the release test after a rebuild: `node scripts/verify-local.mjs`. It uses a disposable
copy, so existing local app data is not touched. Close any running app first because the test uses
the same ports (3000 and 8081).
