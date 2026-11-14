# Import examples

These files exercise the **Data Integration** screen (`More → Data integration`).

| File | Expected behaviour |
| --- | --- |
| `example_valid.csv` | Wide CSV, 16 rows, all columns mapped, zero validation issues. Commits 16 observations. |
| `example_invalid.csv` | Out-of-range values, a non-numeric cell, an unknown astronaut and a malformed timestamp. Each issue is reported with row, column and expected format. |
| `example_nested.json` | JSON with records nested under `data.observations`; the record path must be supplied before parsing. |

Long-format tables (`metric` + `value` columns rather than one column per metric) are **not** silently
reshaped. The importer reports that a dataset-specific adapter is required, which is the documented
extension point (`shared/importing.ts`).

All files are fictional demonstration content. Nothing here is NASA data.


## Exposure, cabin and context adapter

Use Mission context & radiation > CSV/JSON for these files. The original Data Integration page handles vital signs. Update example timestamps when appropriate; dates are not silently refreshed. All example values are simulated and are not CSA/CANS readings.

Common columns: kind, observedAt (ISO time with Z or offset), optional crewId (must match selection), sourceKind (simulated or import), note. The UI supplies source title/reference. Each batch belongs to the selected astronaut, applied mission and stream. Commit is atomic, repeated records are skipped, and changing content or scope requires another preview.

Radiation: kind=radiation, startAt, quantity=absorbed_dose or dose_equivalent, value, unit, location. Optional component=unknown/neutron/mixed, scope=unknown/personal/area, instrument. Absorbed dose units: Gy/mGy/uGy; dose equivalent: Sv/mSv/uSv. No unit conversion is inferred.

Cabin: kind=cabin, location, optional temperatureC, pressureKpa, co2Ppm. At least one numeric measurement is required. Blank is unknown; explicit zero is preserved where permitted.

Context: kind=context; optional phase=unknown/preflight/transit/orbital/surface/recovery, gravity=unknown/microgravity/partial_gravity/earth_gravity, location, sleepQuality=unknown/good/fair/poor, scheduleChanged=unknown/yes/no, bedtime, wakeTime, exerciseType, plannedSessionCompleted=unknown/yes/no, symptom, symptomOnset, symptomChange=unknown/new/ongoing/improving/resolved. Times require a timezone. At least one meaningful context detail is required.

JSON must be an array of flat objects with the same fields as CSV. Nested scientific formats require an adapter; unexpected columns are errors. Do not invent physiological measurements from an article, image or unrelated dataset.
