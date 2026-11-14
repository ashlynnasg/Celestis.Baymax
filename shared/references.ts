/** Curated summaries, not datasets or approved clinical protocols. Reviewed 14 November 2026. */
export type ScienceSource = {
  id: string;
  title: string;
  agency: string;
  url: string | null;
  section: string;
  supports: string;
  limitation: string;
  reviewedAt: string;
  kind: "background" | "research_summary" | "local_assumption";
  thresholdStatus: "not_validated_by_this_source";
  reviewStatus: "project_source_check_only";
};
function source(
  id: string,
  title: string,
  url: string | null,
  supports: string,
  limitation: string,
  section: string,
  agency = "NASA",
  kind: ScienceSource["kind"] = "background",
): ScienceSource {
  return {
    id,
    title,
    agency,
    url,
    supports,
    limitation,
    section,
    kind,
    reviewedAt: "2026-11-14",
    thresholdStatus: "not_validated_by_this_source",
    reviewStatus: "project_source_check_only",
  };
}
export const SCIENCE_REFERENCES = {
  nasaHazards: source(
    "nasa-hazards",
    "NASA — Five Hazards of Human Spaceflight",
    "https://www.nasa.gov/hrp/hazards/",
    "Radiation, isolation/confinement, distance from Earth, gravity fields and closed environments provide a framework for organizing monitoring.",
    "A hazard description does not establish an individual's diagnosis, probability or safe exposure limit.",
    "About the Five Hazards",
  ),
  nasaRisks: source(
    "nasa-risks",
    "NASA — Risks of Human Spaceflight",
    "https://www.nasa.gov/hrp/risks/",
    "Human spaceflight research covers physiological, behavioral and radiation concerns beyond the eight screens implemented here.",
    "The catalogue is not a validated triage algorithm or a list of app alert cutoffs.",
    "Human physiology; behavioral performance; space radiation",
  ),
  nasaResearch: source(
    "nasa-research",
    "NASA — Ongoing HRP Research",
    "https://www.nasa.gov/hrp/ongoing-hrp-research/",
    "Research includes sleep/activity, immune biomarkers, exercise, eye changes and standardized health measurements.",
    "An intervention being investigated is not an approved treatment. This page supplies study summaries, not individual health records.",
    "Human Investigations in Low Earth Orbit",
    "NASA",
    "research_summary",
  ),
  csaRadiation: source(
    "csa-radiation",
    "CSA — Monitoring radiation for astronaut health",
    "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    "CANS is being developed to measure neutron radiation continuously and autonomously, illustrating the importance of exposure records.",
    "The article provides neither CANS readings nor a conversion from exposure to personal cancer probability or an operational dose limit.",
    "CANS development announcement, 26 February 2026",
    "Canadian Space Agency",
    "research_summary",
  ),
  csaDeepSpace: source(
    "csa-deep-space",
    "CSA — Why conduct science experiments in space?",
    "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
    "Deep-space missions involve communication delays and reduced reliance on Earth for supplies and emergency medical assistance.",
    "This motivates local workflow support; it does not validate this app or supply emergency treatment instructions.",
    "Preparing for deep-space destinations",
    "Canadian Space Agency",
  ),
  standardMeasures: source(
    "nasa-standard-measures",
    "NASA — Standard Measures",
    "https://www.nasa.gov/reference/standard-measures/",
    "Consistent measurements across body systems and before, during and after flight help characterize adaptation.",
    "Our optional context form is a project design inspired by this approach, not NASA's study protocol or an implementation of all its tests.",
    "Description and Impact",
    "NASA",
    "research_summary",
  ),
  hrpSleep: source(
    "hrp-sleep",
    "NASA — Inadequate Sleep and Irregular Schedules",
    "https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/",
    "Workload, sleep disruption and irregular light-dark cycles are spaceflight research concerns.",
    "The app's hour thresholds and freshness windows are illustrative engineering settings, not thresholds validated by this page.",
    "What are the top risks?",
  ),
  hrpBone: source(
    "hrp-bone",
    "NASA — Spaceflight-Induced Bone Changes",
    "https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/",
    "NASA studies bone changes in microgravity and uses scans to track changes around flight.",
    "Exercise records cannot measure bone density. Population averages cannot predict an individual's percentage of bone loss.",
    "Top risks; What can be done about it?",
  ),
  hrpMuscle: source(
    "hrp-muscle",
    "NASA — Reduced Cardiorespiratory and Musculoskeletal Fitness",
    "https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/",
    "Maintaining fitness for physical tasks is a human spaceflight research concern.",
    "Recorded exercise minutes are not measured muscle mass, strength or fitness clearance.",
    "Risk overview",
  ),
  hrpCardio: source(
    "hrp-cardio",
    "NASA — Cardiovascular Adaptations",
    "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/",
    "Spaceflight changes cardiovascular function and motivates monitoring of cardiovascular adaptation.",
    "This background does not validate the app's pulse or blood-pressure cutoffs, or diagnose disease from vital signs.",
    "What are the top risks?",
  ),
  hrpVision: source(
    "hrp-vision",
    "NASA — Spaceflight Associated Neuro-ocular Syndrome (SANS)",
    "https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/",
    "NASA investigates eye and brain changes associated with spaceflight and their long-term significance.",
    "A reported vision change alone cannot diagnose SANS. Investigational supplements and devices are not app treatment instructions.",
    "Top risks; What can be done about it?",
  ),
  hrpBehavioural: source(
    "hrp-behavioural",
    "NASA — Behavioral Changes and Psychiatric Disorders",
    "https://www.nasa.gov/reference/risk-of-behavioral-changes-and-psychiatric-disorders/",
    "Behavioral health and performance under spaceflight stressors are active research areas.",
    "Self-reported 0–10 app ratings are not validated psychiatric instruments or diagnoses.",
    "Risk overview",
  ),
  whoFirstAid: source(
    "local-support",
    "Educational support — no approved mission protocol supplied",
    null,
    "The app offers general workflow support and directs medical concerns to authorized personnel.",
    "This locally authored support is not a WHO or NASA protocol and has not received clinical approval.",
    "Local care-support content",
    "Celestial Baymax team",
    "local_assumption",
  ),
  demoEngineering: source(
    "demo-engineering",
    "Celestial Baymax — demonstration assumptions",
    null,
    "Numeric cutoffs, lookback windows, rankings and freshness settings are explicit software demonstration choices.",
    "These rules have not been clinically validated and cannot provide clearance or an individual disease probability.",
    "docs/RULES_AND_LIMITATIONS.md",
    "Celestial Baymax team",
    "local_assumption",
  ),
};
