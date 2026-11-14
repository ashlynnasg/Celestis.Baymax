/**
 * Prevention, treatment-support and recovery content.
 *
 * Content is educational and personalised to the concern that produced it. No protocol is marked
 * approved, no dose is given, and no diagnosis is offered. Unsupplied approvals stay unknown.
 */
import { CATEGORY_META, DOMAINS, REFERENCE_LIBRARY, type Category, type DomainKey } from "./constants";
import type { DomainAssessment, PreventiveSuggestion } from "./domain";

export type ProtocolRecord = {
  title: string;
  source: string;
  version: string;
  reviewer: string;
  approvalStatus: "unapproved" | "unknown" | "approved";
  reviewDate: string;
};

export type CarePlan = {
  domain: DomainKey;
  label: string;
  category: Category;
  categoryMeaning: string;
  emergencyNote: string;
  mayMean: string[];
  cannotConclude: string[];
  prevention: PreventiveSuggestion[];
  firstAid: { title: string; detail: string }[];
  seekReview: string[];
  followUp: string[];
  recoveryMonitoring: string[];
  protocols: ProtocolRecord[];
  references: { label: string; note: string; url: string | null }[];
  limitations: string[];
};

const PROTOCOL_PLACEHOLDER = (domain: string): ProtocolRecord => ({
  title: `${domain} clinical response protocol`,
  source: "Not supplied for this demonstration",
  version: "—",
  reviewer: "Not assigned",
  approvalStatus: "unapproved",
  reviewDate: "Not scheduled",
});

const GENERIC_LIMITATION =
  "This app does not diagnose illness, prescribe medication, give doses, clear an astronaut for duty or replace authorised medical personnel.";

const EMERGENCY_LINE =
  "If there is chest pain, severe breathlessness, fainting, sudden vision loss or a fall with head impact, use the crew emergency procedure immediately — do not work through this app first.";

export function buildCarePlan(assessment: DomainAssessment): CarePlan {
  const definition = DOMAINS[assessment.domain];
  const category = assessment.category;
  const concernActive = category === "priority" || category === "review";
  const meta = CATEGORY_META[category];

  const base = {
    domain: assessment.domain,
    label: definition.label,
    category,
    categoryMeaning: meta.meaning,
    emergencyNote: EMERGENCY_LINE,
    prevention: assessment.preventive,
    protocols: [PROTOCOL_PLACEHOLDER(definition.label)],
    references: assessment.references.map((key) => ({
      label: REFERENCE_LIBRARY[key].title,
      note: REFERENCE_LIBRARY[key].supports,
      url: REFERENCE_LIBRARY[key].url,
    })),
    limitations: [GENERIC_LIMITATION],
  };

  const categorySummary = (active: string, quiet: string, missing: string): string[] => {
    if (category === "more_data") return [missing];
    return concernActive ? [active] : [quiet];
  };

  switch (assessment.domain) {
    case "cardiovascular":
      return {
        ...base,
        mayMean: categorySummary(
          "A recorded resting heart rate, oxygen saturation or blood pressure sits outside the demonstration band. That can reflect activity, stress, dehydration, cuff placement or a genuine cardiovascular concern; the app cannot tell which.",
          "Recorded cardiovascular values are inside the demonstration band. This does not exclude cardiovascular disease.",
          "No current resting cardiovascular measurement is available, so the screen cannot separate a normal result from an unmeasured one.",
        ),
        cannotConclude: [
          "Heart rate and oxygen saturation cannot diagnose cardiovascular or respiratory disease.",
          "A single reading cannot establish a trend; context (rest, post-exercise, caffeine, hydration) changes the meaning.",
          "Blood pressure entered without cuff details cannot be judged for technique error.",
        ],
        firstAid: [
          {
            title: "Chest pain or pressure",
            detail:
              "Stop activity, sit down and call for the crew medical officer. Follow the crew emergency procedure. Do not wait for another app reading.",
          },
          {
            title: "Dizziness on standing",
            detail:
              "Sit or lie down before moving further, raise the legs if tolerated and report the episode. Record hydration notes afterwards.",
          },
        ],
        seekReview: [
          "A priority flag here should be discussed with the responsible medical officer before demanding activity or EVA.",
          "Any fainting, chest pain, breathlessness at rest or a persistent resting heart rate above the demonstration band warrants prompt review.",
        ],
        followUp: [
          "Repeat a resting heart rate and oxygen saturation tomorrow, at a similar time, before exercise.",
          "Record blood pressure only if a calibrated cuff and trained operator are available; note cuff size and arm.",
        ],
        recoveryMonitoring: [
          "Track resting heart rate and saturation daily for one week and compare with the 14-day baseline.",
          "Note when a value returns inside the demonstration band without claiming clinical recovery.",
        ],
      };
    case "boneHealth":
      return {
        ...base,
        mayMean: categorySummary(
          "Loading exercise has fallen below the demonstration floor, or a bone history entry is present. Both raise a monitoring need; neither measures bone mineral density.",
          "Loading exercise meets the demonstration floor and no bone-density concern is recorded.",
          "There are no recent loading-exercise records, so the monitoring need is unknown rather than absent.",
        ),
        cannotConclude: [
          "Exercise logs cannot establish bone density or bone loss.",
          "Self-reported fracture history is not a density measurement.",
          "The app makes no forecast of bone loss over a mission.",
        ],
        firstAid: [
          {
            title: "Suspected fracture or acute bone pain",
            detail:
              "Immobilise the area, avoid loading it and report immediately to the crew medical officer. This app cannot assess a fracture.",
          },
        ],
        seekReview: [
          "Persistent bone or joint pain that limits loading exercise.",
          "A fall or impact in a reduced-gravity environment, even without obvious injury.",
        ],
        followUp: [
          "Log the next loading session with duration, mode and any pain note.",
          "Keep the resistive and treadmill sessions in the schedule; record missed sessions explicitly.",
        ],
        recoveryMonitoring: [
          "Compare weekly loading minutes against the previous week rather than a single day.",
          "Note pain-limited sessions; they change what the numbers mean.",
        ],
      };
    case "muscleConditioning":
      return {
        ...base,
        mayMean: categorySummary(
          "Recorded exercise volume is below the demonstration conditioning floor. That may indicate reduced conditioning, a crowded schedule or deliberate deloading.",
          "Recorded exercise volume meets the demonstration conditioning floor.",
          "No recent exercise records are available, so conditioning volume is unknown.",
        ),
        cannotConclude: [
          "Exercise minutes cannot measure muscle mass, strength or power.",
          "A low week may reflect scheduling or recovery, not deconditioning.",
        ],
        firstAid: [
          {
            title: "Sudden weakness or inability to bear load",
            detail:
              "Stop the task, support the limb and report to the crew medical officer. Do not test the limb with more exercise.",
          },
        ],
        seekReview: ["Progressive weakness, or loss of function that does not recover with rest."],
        followUp: [
          "Record two short loading sessions per day for three days.",
          "Add a note describing the mode (resistive, treadmill, cycle) so the volume is interpretable.",
        ],
        recoveryMonitoring: [
          "Track weekly exercise minutes and subjective effort together.",
          "Treat an increase in minutes as behaviour change, not proof of muscle gain.",
        ],
      };
    case "sleepRestriction":
      return {
        ...base,
        mayMean: categorySummary(
          "Recorded sleep is below the demonstration floor, or a single night fell below the priority floor. This describes sleep opportunity, not sleep quality or a diagnosis.",
          "Recorded sleep is at or above the demonstration floor.",
          "No current sleep record exists, so restriction cannot be screened.",
        ),
        cannotConclude: [
          "Self-reported duration cannot measure sleep quality, fragmentation or circadian phase.",
          "A short night may be a schedule effect rather than insomnia.",
        ],
        firstAid: [
          {
            title: "Severe sleepiness during a critical task",
            detail:
              "Stop the task, hand over and rest. Do not continue hazardous work while unable to maintain attention.",
          },
        ],
        seekReview: [
          "Persistent short sleep with daytime impairment despite protected sleep opportunities.",
          "Any sleep problem accompanied by confusion or unsafe behaviour.",
        ],
        followUp: [
          "Record the next two nights and the morning fatigue rating together.",
          "Note duty timing next to the sleep record so schedule effects are visible.",
        ],
        recoveryMonitoring: [
          "Aim for consistent sleep and wake times; compare the seven-day median weekly.",
          "Watch whether fatigue ratings fall as duration rises; the two are recorded separately for a reason.",
        ],
      };
    case "fatigue":
      return {
        ...base,
        mayMean: categorySummary(
          "The crew member reports fatigue at a level the demonstration rules treat as significant. Fatigue has many causes, including sleep debt, workload, illness and stress.",
          "Reported fatigue is below the demonstration review threshold.",
          "No current fatigue rating exists, so fatigue cannot be screened.",
        ),
        cannotConclude: [
          "A subjective rating cannot identify a cause and is not a clinical measure.",
          "Fatigue is not equivalent to impairment; objective performance is not measured here.",
        ],
        firstAid: [
          {
            title: "Unsafe to continue",
            detail:
              "If the crew member cannot safely perform the task, stop, hand over and escalate. Do not wait for a questionnaire to finish.",
          },
        ],
        seekReview: [
          "Fatigue that persists despite protected sleep opportunities.",
          "Fatigue with fever, breathlessness, chest pain or confusion — treat as a medical concern, not a scheduling issue.",
        ],
        followUp: [
          "Re-rate fatigue before the next demanding task and after the next sleep period.",
          "Record the main driver (sleep, workload, illness, stress) in a note.",
        ],
        recoveryMonitoring: [
          "Track the rating across the week alongside sleep duration.",
          "A falling rating is a screening change; it does not prove recovery.",
        ],
      };
    case "visionChange":
      return {
        ...base,
        mayMean: categorySummary(
          "A vision change is reported. Reported changes can include blurring, field loss, flashing lights or altered focus, and require clinical assessment.",
          "The last explicit report states no vision change.",
          "The vision field is unanswered, which is not the same as reporting no change.",
        ),
        cannotConclude: [
          "Self-report cannot diagnose a spaceflight-associated neuro-ocular condition or any other eye condition.",
          "Visual acuity, visual fields and retinal appearance are not measured by this app.",
        ],
        firstAid: [
          {
            title: "Sudden vision loss or new flashing lights",
            detail:
              "Stop visual-critical tasks and report immediately for clinical assessment. Do not drive or operate equipment.",
          },
        ],
        seekReview: [
          "Any new or worsening vision change requires ophthalmological review before demanding visual tasks.",
          "A change with headache, confusion or weakness is an emergency pathway.",
        ],
        followUp: [
          "Record an explicit vision statement at the next check, even if nothing has changed.",
          "Note which eye, what changed and whether it is constant or intermittent.",
        ],
        recoveryMonitoring: [
          "Track repeated explicit reports; a change from 'changes reported' to 'no change reported' is a screening change only.",
        ],
      };
    case "stressWellbeing":
      return {
        ...base,
        mayMean: categorySummary(
          "The reported stress rating is at a level the demonstration rules treat as significant, or a behavioural-health history entry is present.",
          "The reported stress rating is below the demonstration review threshold.",
          "No current stress rating exists, so well-being cannot be screened.",
        ),
        cannotConclude: [
          "A 0–10 rating is not a mental-health assessment and cannot diagnose a condition.",
          "The app does not monitor behaviour, communication or performance.",
        ],
        firstAid: [
          {
            title: "Acute distress",
            detail:
              "Stay with the crew member, remove immediate hazards and contact the crew medical officer or behavioural-health support. Do not leave someone in acute distress alone.",
          },
        ],
        seekReview: [
          "Persistent high stress ratings, sleep disruption and withdrawal from crew activity.",
          "Any disclosure of self-harm or intent to harm others — escalate immediately.",
        ],
        followUp: [
          "Re-rate stress and sleep daily for a week.",
          "Record which support was used (confidential conference, crew conversation, rest period).",
        ],
        recoveryMonitoring: [
          "Watch the trend rather than a single score, and record supportive actions taken.",
        ],
      };
    case "respiratory":
      return {
        ...base,
        mayMean: categorySummary(
          "Oxygen saturation is below the demonstration band. Measurement artefact, cold extremities, motion, altitude and genuine respiratory concerns can all produce this.",
          "Oxygen saturation is inside the demonstration band.",
          "There is no current oxygen saturation value, so the respiratory screen cannot conclude anything.",
        ),
        cannotConclude: [
          "Pulse oximetry cannot diagnose respiratory disease and can be inaccurate with poor perfusion.",
          "A single value does not describe lung function or exercise tolerance.",
        ],
        firstAid: [
          {
            title: "Breathlessness at rest",
            detail:
              "Sit upright, stay calm, use the crew emergency procedure and call for the medical officer. Do not delay for another reading.",
          },
          {
            title: "Known asthma with wheeze",
            detail:
              "Follow the crew member's own prescribed plan; the app does not provide doses or medication advice.",
          },
        ],
        seekReview: ["Breathlessness at rest, blue lips, confusion or a saturation that stays low on repeat."],
        followUp: [
          "Repeat at rest with warm hands after five minutes.",
          "Note whether the crew member is at altitude or in a changed cabin pressure environment.",
        ],
        recoveryMonitoring: ["Record saturation alongside symptoms until two consecutive rest values are inside the band."],
      };
    default:
      return {
        ...base,
        mayMean: [meta.meaning],
        cannotConclude: [GENERIC_LIMITATION],
        firstAid: [],
        seekReview: [],
        followUp: [],
        recoveryMonitoring: [],
      };
  }
}
