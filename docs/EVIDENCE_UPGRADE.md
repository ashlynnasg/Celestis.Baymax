# NASA/CSA evidence edition — version 1.1.0

This update extends the supplied Hybrid Theme / SQLite Windows application. It keeps the existing visual identity and adds a scientific evidence layer. It does not train a prediction model or replace demonstration cutoffs with clinical standards.

## What changed

- All five user-supplied NASA/CSA resources are catalogued with a supported claim, evidence boundary, relevant section and source-check date. Specific NASA sleep, bone, fitness, cardiovascular, vision and behavioral-health pages supplement them.
- A previously mismatched bone-health URL has been corrected. An unverified WHO attribution has been removed; local care support is explicitly described as locally authored educational content.
- Every domain now has hazard tags, a research topic and explicit threshold provenance. Assessment, assistant, care and report references use the same catalogue.
- Overview shows the five hazards with **Not assessed**, **Older records**, or **Partial records** coverage. These are evidence-availability states, not new medical categories. The existing four medical review categories are unchanged.
- Mission context records include phase, gravity, sleep quality/schedule, optional bedtime/wake time, exercise type/completion and symptom history.
- Exposure records retain interval, quantity, original unit, component, personal/area scope, location and source. There is no conversion, summation, safe-dose assessment or cancer prediction.
- Cabin records can store temperature (C), pressure (kPa) and carbon dioxide (ppm), independently of personal SpO2. No environmental alarms or safe-cabin claims are implemented.
- New records are stored separately in an additive SQLite table. Ordinary setup and initialization do not erase existing tables. Records are scoped by astronaut, applied mission and simulation stream; history retains earlier mission records.
- CSV/JSON exposure/context imports have an explicit flat adapter, a preview, field errors, atomic commit and duplicate protection. They do not accept webpages as measurement data. The original flexible vital-sign importer remains available.
- Saved contextual evidence creates a dated note in matching continuing cases. Context alone does not change their clinical category.
- Queueing a handover captures the current evidence, source metadata and mission snapshot; later records do not rewrite a queued handover. Legacy snapshots without the added fields still render.
- The local assistant directly explains sources, hazard coverage, radiation records and contextual next checks. Answers remain deterministic and require no paid AI service.
- New seed/scenario generation avoids future timestamps when setup runs before the nominal UTC sampling hour. Existing records are preserved; screening excludes future observations until their timestamp is reached.
- Normal startup serves the bundled web build and API. Metro is retained for development, so routine startup does not need to compile the interface.

## Data and clinical boundaries

The reference pages describe hazards and research; they do not supply individual astronaut medical histories or validate this app's numeric thresholds. Sources establish monitoring relevance. Clinical approval remains unsupplied. No research intervention is automatically recommended as treatment.

Optional context and exposure records deliberately do not alter the four screening categories. Demanding workload/EVA can add contextual follow-up prompts. Destination is still descriptive; no planetary disease-risk multiplier is calculated.

Context coverage uses a 72-hour display freshness window. This is an engineering choice, not an agency measurement cadence. A recent exposure record does not establish complete exposure history or safe radiation levels. Personal and area measurements remain distinct. Missing values remain unknown, while an explicitly recorded zero is preserved.

Exposure records cover only absorbed dose (Gy/mGy/uGy) and dose equivalent (Sv/mSv/uSv). Other quantities, dose rates, raw detector counts, effective-dose models, conversion factors and overlapping-interval aggregation need a separately reviewed adapter and cannot be inferred.

## Demo route

1. Open Overview and select a fictional astronaut.
2. Explore a hazard and the related domain. Inspect the evidence, reference scope and demo-rule basis.
3. In Mission context & radiation, record a fictional schedule/phase check-in.
4. Open CSV/JSON and load the simulated exposure example. Preview, commit and repeat it to see duplicate protection.
5. Ask the assistant: What radiation records are available? Then: Which NASA sources support this concern?
6. Inspect the related case notes, create and queue a handover, and inspect its frozen evidence. Later edits must not rewrite the queued snapshot.
7. Switch to a simulation run. Baseline context must not supply that run's coverage.

## Existing installations

Stop the previous app. Back up the entire data folder while it is stopped. Extract this edition into a new writable folder, and copy the backed-up data folder into it if you want to retain the existing owner and records. Run setup_windows.cmd, then start_windows.cmd. The additive schema creates missionLogs without replacing prior records. No MySQL migration or database server is required.

Do not merge node_modules, .runtime or old dist/web-dist output into this edition. Those are rebuilt dependencies or version-specific output. A fresh installation creates its own local owner.
