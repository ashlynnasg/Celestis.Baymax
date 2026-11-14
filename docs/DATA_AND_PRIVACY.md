# Celestial Baymax — data, storage and privacy notes

Celestial Baymax is a hackathon demonstration. It is **not** certified for real medical records, and
the prototype must not be used with real astronaut or patient data.

## Where data lives

| Data | Storage |
| --- | --- |
| Crew profiles and medical history | Local SQLite table `crewProfiles` (`data/celestial-baymax.sqlite`) |
| Observations (manual, imported or simulated) | `observations`, tagged with stream, source, unit and context |
| Mission draft / applied configuration | `missionPlans` + `appState.appliedMissionId` |
| Simulation runs | `simulationRuns` (own stream, seeded generator, baseline never mutated) |
| Cases and dated events | `cases`, `caseEvents` |
| Guided checks | `guidedChecks` (including decline reasons) |
| Handovers, state history, fictional replies | `handovers`, `handoverEvents`, `groundReplies` |
| Import batches | `importBatches` (mapping, errors, counts, checksum, normalised rows) |
| Owner account and sessions | `owners` (scrypt hash + salt), `ownerSessions` (SHA-256 token hash, expiry) |

Nothing is stored only in a hardcoded array or only on the device. The selected astronaut, the owner
session token and the assistant thread keys are kept on the device (AsyncStorage) as UI state only.

## Owner access

- One local owner account per installation. There is **no default or embedded passphrase**; the first
  run asks you to create one (minimum 10 characters).
- The passphrase is hashed with scrypt and a random 16-byte salt; only the hash is stored.
- Login issues a random 32-byte bearer token. Only its SHA-256 hash is stored, with a 12-hour absolute
  expiry. Logout revokes the session server-side.
- Every tRPC route except `owner.*` and `system.*` is gated by server middleware, so read access is
  protected too — not just the buttons in the UI.

Known gaps, stated honestly:

- The SQLite file is **not encrypted at rest** merely because an owner account exists.
- There is no audit log of reads, no multi-factor authentication and no role model beyond the single
  owner.
- Each ZIP extraction creates a separate SQLite database; reset and imports affect only that local installation.
  The new local database does not synchronize with any Manus-hosted version or other laptops.

## Import safety

- Bounded input: 2 MB of text and 2000 rows.
- File names and cell content are treated as untrusted text; no server-side path is ever opened.
- Column mapping is suggested automatically and can be overridden per column; unsupported columns are
  kept but not converted, and the batch notes say which adapter is required.
- Validation covers required fields, types, ranges, enum values, astronaut identity, timestamp format
  and duplicates, with a row/column/message/expected format for each issue.
- Commit is atomic. "Validated rows only" is an explicit choice, off by default.
- A repeated import of the same checksum is refused; identical observations are skipped row by row.
- CSV export neutralises cells that start with `=`, `+`, `-`, `@`, tab or carriage return to prevent
  spreadsheet formula injection.

## Exports

`exports.observationsCsv` and `exports.bundleJson` produce files on the device share sheet (or a
browser download). Exports include unit, source, stream, context and the rule-set version used for the
assessment snapshot.

## Reset

`state.resetDemo` requires the literal confirmation text `RESET DEMO` and is never automatic. It
restores the seeded fictional dataset and keeps the owner account. The seed runs once per
installation, so relaunching never duplicates crew profiles.


## Additional evidence data (1.1.0)

missionLogs stores source-labelled phase/schedule/activity/symptom context, exposure records and cabin conditions. It is protected by the same backend owner gate. These are separate from curated reference summaries. Records identify crew, stream, mission and original observation time; earlier mission records remain in history. Database initialization adds this table without resetting existing owner or crew data.

No NASA/CSA individual health records are supplied. Source summaries are offline reference content; external links are opened only on request. Exports can include notes, context, source metadata and frozen snapshots, so continue using fictional data. The explicit RESET DEMO workflow now also removes context/exposure/cabin records; routine setup and startup do not.
## Managed MySQL (mobile build)
The mobile build stores the same thirteen demonstration tables in the project's managed MySQL database
(Drizzle migrations in `drizzle/`). Domain timestamps are stored as UTC epoch milliseconds, so exports
and the SQLite backup keep one unambiguous time base. Account tables (`users`, `owners`,
`ownerSessions`) stay in the same database but are excluded from the portable backup.

Settings → *Download SQLite backup* generates a real SQLite database with `node:sqlite` (falling back
to a `.sql` dump when the runtime lacks the module). The file carries fictional demonstration records
only, records its generation time in `_backup_meta`, and is intended for inspection, archiving or
moving the demonstration dataset to a SQLite-compatible viewer — never for real patient data.
