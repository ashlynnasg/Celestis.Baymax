# Known limits — evidence edition 1.1.0

- Native Windows execution and a full interactive browser session were not available during this update. See TEST_REPORT.md for exactly what was run. The Windows scripts and responsive behaviour still need a local smoke test on the team's laptops.
- Agency resources explain monitoring relevance. They do not validate numeric screening cutoffs, clinical decisions or radiation safety limits. All existing clinical thresholds remain demo assumptions.
- Radiation handling is a record/validation workflow. It does not convert, sum, forecast, calculate personal risk or trigger operational alarms. Detector counts, rates and other quantities need a reviewed adapter.
- The context importer accepts explicit flat CSV/JSON fields, unlike the original vital-sign importer with column mapping. Unsupported scientific formats require an adapter. References cannot be imported as physiological data.
- Current coverage is scoped to the selected astronaut, stream and applied mission. Earlier records are visible in history, but are not automatically transferred to another mission. Context alone does not alter the four clinical review categories.
- The assistant is deterministic and supports bounded phrasing. Unknown questions are declined. Sources are project-checked; no clinical content approval is claimed.
- The eight screens do not cover NASA's entire risk catalogue, all environmental hazards, radiation physiology or a complete EVA examination.
- Local SQLite is not encrypted. There is one owner account and no role hierarchy, clinical audit certification or password-reset workflow. Use fictional data.
- One unused starter auth.logout test for the old Manus cookie flow is intentionally skipped. Local owner authorization, logout and session persistence are checked separately over HTTP.
- The Expo body map retains a known SVG responder warning; the labelled domain controls provide the text alternative. Reduced motion still follows platform behaviour rather than a dedicated app toggle.
- After editing code, run npm run build and npm run build:web before normal startup. npm run dev uses live source.
