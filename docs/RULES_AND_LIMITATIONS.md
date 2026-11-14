# Celestial Baymax — rules, thresholds and limitations

Rule set `demo-rules-1.1.0-evidence` · seed `seed-1.0.0` · timezone `UTC`.

Every number below is an **illustrative demonstration engineering setting**. It is not a NASA
clinical standard, not a validated triage rule and not an operational flight-medicine protocol.
Changing any value requires updating this file, because the in-app "Rules and assumptions" panel
quotes the same constants from `shared/constants.ts`.

## Review categories (verbatim, sorted worst-first)

| Order | Category | Meaning shown in the app |
| --- | --- | --- |
| 1 | **Priority Review** | Significant concerns warrant priority medical assessment before demanding activities. |
| 2 | **Review Before Assignment** | Concerns warrant further evaluation. |
| 3 | **More Data Needed** | Insufficient information for meaningful screening. |
| 4 | **No Demo Flags** | No implemented demonstration screening alerts identified. Formal medical clearance is still required. |

Rules that protect the meaning of these labels:

- Known priority concerns stay visible even when other fields are missing.
- Unknown data never silently produces a green result; the missing field is reported as a gap.
- `No Demo Flags` never renders "healthy", "safe", "cleared" or "fit for EVA".
- Completeness is reported as "N of M relevant fields available", never as a health percentage.
- Freshness is a separate engineering setting and is never mixed into the concern category. Opening
  the app does not make an old observation fresh.

## Freshness windows (hours)

| Field | Window |
| --- | --- |
| Heart rate, oxygen saturation | 72 |
| Systolic / diastolic blood pressure | 168 |
| Sleep duration | 48 |
| Stress, fatigue | 72 |
| Exercise duration | 48 |
| Vision statement | 168 |
| Body temperature (not used by a domain) | 24 |

The most recent value **inside** its window is used for a domain's screening. Older values remain
visible as evidence and are labelled stale.

## Domain rules

### Cardiovascular
- Resting heart rate: priority ≥ 110 bpm, review ≥ 90 bpm.
- Documented hypertension tightens the priority rule to ≥ 100 bpm.
- Oxygen saturation: priority ≤ 90 %, review ≤ 94 %.
- Systolic blood pressure: review ≥ 140 mmHg, priority ≥ 160 mmHg; diastolic review ≥ 90, priority ≥ 100.
- Only `rest` or `unknown` context values are compared with resting thresholds. After-exercise values
  are excluded and the exclusion is stated, because unlike contexts cannot be compared.
- Empty field → `More Data Needed` (for example "No systolic blood pressure recorded for cardiovascular").

### Respiratory
- Oxygen saturation ≤ 90 % priority, ≤ 94 % review, with a tighter ≤ 92 % pathway when respiratory
  history is documented.

### Sleep restriction
- Median sleep over the lookback: review < 6.0 h, priority < 4.5 h.
- Any single night < 3.5 h → priority.
- A demanding workload lowers the review floor by 0.5 h (`demandingWorkloadSleepShift`).

### Fatigue
- Self-reported 0–10 rating: review ≥ 6, priority ≥ 8.

### Stress and well-being
- Self-reported 0–10 rating: review ≥ 6, priority ≥ 9.
- A documented behavioural-health history adds review context, never a diagnosis.

### Reported vision change
- "Vision changes reported" → priority (clinical assessment needed).
- "No vision change reported" → no flag.
- Unanswered → `More Data Needed`. An unanswered field is never converted into "no change reported".

### Bone health
- Documented bone-density concern → review regardless of current exercise.
- Otherwise average loading exercise ≥ 30 min/day for missions of 180 days or more (review below
  20 min/day, priority below 10 min/day on shorter missions).

### Muscle conditioning
- Average exercise minutes/day: review < 20, priority < 10. Missions ≥ 180 days raise the review floor
  to 30 min/day.

## Mission inputs and what they change

`docs`-visible mapping is also returned by `mission.influences` and shown in the app:

| Input | Effect |
| --- | --- |
| Duration ≥ 180 days | Raises the bone/conditioning review floor to 30 min/day. |
| Workload = demanding | Lowers the sleep review floor by 0.5 h. |
| EVA required | Adds a pre-EVA data requirement for resting heart rate and oxygen saturation. |
| Destination, activity level | Descriptive metadata only; disclosed as not affecting thresholds. |
| Crew scope | Display scope only. |

Applying a mission recalculates every screen from the same configuration. No mission input can
produce a clearance decision.

## Mission health simulator

Six scenarios: normal health, sleep deprivation, cardiovascular strain, vision changes, reduced
exercise, recovery and improvement. Each run generates **seven daily simulated observations** for
seven metrics from a seeded deterministic generator, stores them in their own stream, and leaves the
recorded baseline untouched. Replay uses the selected day as its assessment clock and is read-only.

## Baymax assistant

Offline intent recognition over templates and the shared assessment output. It answers questions
about concerns, reasons, prevention, next actions, treatment support, crew prioritisation, EVA
readiness (by requiring authorised review) and category assignment. It never invents findings or
citations, reframes diagnostic questions as observed concerns, and declines unsupported questions
while listing supported topics.

## What this app does not do

- No sensors, wearables or camera-derived vital signs; no automatic measurement of any kind.
- No disease prediction, no probability of disease, no black-box risk score, no trained model.
- No diagnosis, prescribing, dosing, astronaut clearance or replacement of medical personnel.
- No real message transmission; the Deep Space Link is local and fictional.
- No claim of clinical benefit or flight readiness.


## Evidence edition (1.1.0)

Numeric clinical screening cutoffs have not changed in this edition. Every domain now declares the relevant scientific topic separately from threshold provenance. NASA/CSA resources support why monitoring matters; they do not validate these cutoffs. Context/phase, radiation and cabin records alter coverage and follow-up explanations only, not medical categories.

Coverage states (not_assessed, stale, partial) are independent of the four medical review categories. Their 72-hour freshness setting is for demo display, not a clinical sampling recommendation. An area radiation reading cannot be treated as a person's exposure. Absorbed dose and dose equivalent remain distinct and no conversions, totals, cancer probabilities or safe-exposure limits are calculated.

See EVIDENCE_UPGRADE.md and REFERENCES.md for scope. Research summaries do not imply approved interventions. The historical whoFirstAid reference key is retained for compatibility but now explicitly points to locally authored educational support, with no WHO attribution or external protocol approval.
## Mobile build notes (Expo + managed MySQL)
This build keeps the evidence edition rules and adds a portrait mobile shell: a persistent context bar
(astronaut · stream · applied mission), a one-tap crew switcher, mobile-first screening cards and a
documented SQLite-compatible backup. The data layer runs on the project's managed MySQL database; the
backup produces a real `.sqlite` file (or an equivalent `.sql` dump) with the original table names.
Category ranking, unknown-vs-zero handling, hazard coverage and the Deep Space Link transitions are
unchanged from the evidence edition. Body-map regions are decorative navigation; the labelled domain
buttons and the text lists are the accessible equivalents.
