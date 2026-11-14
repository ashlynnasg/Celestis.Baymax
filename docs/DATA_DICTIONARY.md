# Evidence edition data dictionary

## Scientific sources (offline catalogue)

shared/references.ts declares id, title, agency, URL, relevant section, supported claim, limitation, source-check date, content kind, threshold status and review status. It contains curated summaries of the five user-supplied resources and specific NASA risk/study pages. No row is an individual astronaut measurement. Clinical review/approval is not asserted.

## Existing clinical observations

The observations table and ten metric keys retain their original definitions in shared/constants.ts. Existing units, simulation/source tags, numeric values, explicit vision reports, observation timestamps, import batches and stream IDs continue to work. Missing values remain null. Only observations at or before the assessment clock are used by the screening engine.

## missionLogs (additive SQLite table)

- id: stable record UUID.
- crewId: existing fictional astronaut identifier, verified by the API.
- streamKey: baseline or saved simulation run ID.
- missionId: applied mission ID at save time, or null if none.
- observedAt: original ISO timestamp, stored in UTC.
- fingerprint: SHA-256 of normalized identity, stream, mission, timestamp, payload, note and provenance, to prevent duplicate records.
- recordJson: validated record including sourceKind (manual/import/simulated), sourceLabel, sourceRef, note, createdAt and the typed data below.

## Context payload

kind=context; phase, gravity, location; optional sleep quality/schedule change and bedtime/wake time; exercise type and reported completion; symptom, onset and reported change. Unknown choices remain unknown. Self-reports are not clinical instruments and do not alter medical review categories.

## Radiation payload

kind=radiation; exposure start; end in observedAt; quantity (absorbed_dose or dose_equivalent), value, original unit, component, personal/area/unknown scope, location and optional instrument metadata. Gy-family and Sv-family units are validated against quantity and remain distinct. No conversions, totals or personal radiation-risk estimates are calculated.

## Cabin payload

kind=cabin; location; optional temperatureC (C), pressureKpa (kPa), co2Ppm (ppm). Blank values are null; at least one measurement is required. These fields are not personal SpO2 and do not drive safety alarms.

## Assessment enrichment

Each domain has scientificContext: hazard tags, research topic, reference keys, interpretation boundary and threshold basis. Every assessment bundle includes spaceContext: scoped records, context facts, five hazard coverage entries and contextual workflow prompts. Coverage is partial/stale/not_assessed and is independent of the four clinical review categories. A 72-hour display window is a demonstration engineering setting.

## Cases and handovers

A saved evidence record produces an idempotent note in matching open cases for that crew and stream. A queued handover freezes current mission/context evidence, source metadata, rule-set version, assessment time and stream ID. Later data does not rewrite that snapshot. Older handovers without new metadata remain readable.

## Import constraints

The new adapter accepts flat CSV or a JSON array, at most 1,000,000 characters and the original parser's 2,000-row limit. Timestamps require explicit timezone. Unexpected/duplicate/blank columns, mismatched crew, reversed intervals, invalid numeric values and incompatible quantity/unit pairs are rejected. Commit revalidates all rows and requires the preview fingerprint to match content, source, mission and stream. No partial commits are offered in this adapter. The existing vital-sign importer retains its mapping workflow.
