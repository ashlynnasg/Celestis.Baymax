# Windows / SQLite compatibility changes

This edition uses the uploaded Manus source as its base. Screens, styles, components, shared
screening rules, assistant logic, NASA/CSA references and simulation rules are unchanged.

- Live Drizzle storage now uses SQLite and Node's built-in database module. No native addon,
  database service or MySQL credentials are required.
- Boolean columns retain boolean values in the application; owner session timestamps retain Date
  values through SQLite timestamp_ms columns. Domain timestamps retain epoch milliseconds.
- Schema bootstrap is idempotent and never drops existing records. Demo seeding is unchanged.
- Mission evidence writes use serialized transactions; duplicate fingerprints remain unique.
- The existing local owner authentication and credential-free SQLite download are retained.
  A missing await in the session last-seen update is corrected so that update actually executes.
- SQLite export module loading works in the bundled ESM server, and handles close before Windows
  temporary-directory cleanup, including failed exports.
- API startup waits for data initialization and listens on loopback. CORS receives exact local
  browser origins from the launcher. Ready-to-run server/browser bundles are included.
- Windows launchers quote paths and require no administrator access. Optional Node download uses
  the official release and verifies its published SHA-256 checksum.
- Original MySQL migration files are retained under docs/legacy-mysql-migrations for reference.
  They are not executed by this edition. There is no automatic migration of hosted MySQL records.

The executable data remains local and unencrypted on disk, as in the supplied prototype.
This is the same fictional health-screening demonstration; changing storage is not clinical validation.

See WINDOWS_SQLITE_TEST_REPORT.md for actual verification and platform limitations.
