import type { ScienceSource } from "./references";
import type { ScienceContext, SpaceContextReport } from "./mission-context";
import type {
  Category,
  DomainKey,
  HeartRateContext,
  MetricKey,
  ReferenceKey,
  ScenarioKey,
} from "./constants";

/* ------------------------------------------------------------------ crew */

export type YesNoUnknown = "yes" | "no" | "unknown";

export type CrewHistory = {
  previousConditions: string[];
  injuriesSurgeries: string[];
  medications: { name: string; dose: string; schedule: string }[];
  allergies: string[];
  familyHistory: {
    relationship: string;
    condition: string;
    status: YesNoUnknown;
  }[];
  cardiovascular: {
    conditions: string[];
    knownHypertension: YesNoUnknown;
    notes: string;
  };
  boneMuscle: {
    boneDensityConcern: YesNoUnknown;
    priorFracture: YesNoUnknown;
    muscleLossConcern: YesNoUnknown;
    notes: string;
  };
  sleepWellbeing: {
    baselineSleepHours: number | null;
    insomniaHistory: YesNoUnknown;
    anxietyHistory: YesNoUnknown;
    notes: string;
  };
  vision: {
    correctiveLenses: YesNoUnknown;
    priorVisionChanges: YesNoUnknown;
    notes: string;
  };
  respiratory: {
    asthma: YesNoUnknown;
    notes: string;
  };
  missionHistory: {
    previousConcerns: string[];
    evaHours: number | null;
    notes: string;
  };
};

export type CrewProfile = {
  id: string;
  displayName: string;
  callSign: string;
  role: string;
  age: number;
  sexAtBirth: string;
  heightCm: number;
  weightKg: number;
  bloodType: string;
  missions: string[];
  archived: boolean;
  history: CrewHistory;
  createdAt: string;
  updatedAt: string;
};

export type CrewListItem = {
  profile: CrewProfile;
  category: Category;
  headline: string;
  openCaseCount: number;
  latestObservationAt: string | null;
  completeness: { available: number; total: number };
  dataGaps: string[];
  streamLabel: string | null;
};

/* ------------------------------------------------------------ observation */

export type ObservationSourceKind = "seed" | "manual" | "import" | "simulated";

export type Observation = {
  id: string;
  crewId: string;
  metric: MetricKey;
  numericValue: number | null;
  textValue: string | null;
  unit: string;
  context: HeartRateContext | null;
  observedAt: string;
  sourceKind: ObservationSourceKind;
  sourceLabel: string;
  streamId: string | null;
  importBatchId: string | null;
  note: string | null;
  createdAt: string;
};

export type ObservationInput = Omit<Observation, "id" | "createdAt">;

/* ---------------------------------------------------------------- mission */

export type MissionSettings = {
  id: string;
  name: string;
  destination: string;
  durationDays: number;
  activityLevel: "low" | "moderate" | "high";
  workload: "light" | "standard" | "demanding";
  evaRequired: boolean;
  status: "draft" | "applied" | "archived";
  crewScope: "all_crew" | "selected_crew";
  createdAt: string;
  appliedAt: string | null;
};

export type MissionDraftInput = {
  destination: string;
  durationDays: number;
  activityLevel: MissionSettings["activityLevel"];
  workload: MissionSettings["workload"];
  evaRequired: boolean;
  crewScope: MissionSettings["crewScope"];
};

/* ------------------------------------------------------------- assessment */

export type EvidenceItem = {
  kind: "observation" | "history" | "derived";
  label: string;
  value: string;
  unit: string;
  observedAt: string | null;
  context: string | null;
  sourceLabel: string | null;
  observationId: string | null;
  field: string | null;
};

export type PreventiveSuggestion = {
  title: string;
  detail: string;
  reason: string;
  area:
    | "exercise"
    | "sleep"
    | "nutrition"
    | "hydration"
    | "stress"
    | "monitoring"
    | "review";
};

export type NextCheck = {
  id: string;
  domain: DomainKey;
  metric: MetricKey;
  prompt: string;
  reason: string;
  ruleIds: string[];
  urgent: boolean;
};

export type MetricSnapshot = {
  metric: MetricKey;
  label: string;
  unit: string;
  value: string | null;
  observedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  missing: boolean;
  sourceLabel: string | null;
  context: string | null;
  streamLabel: string | null;
};

export type DomainAssessment = {
  scientificContext: ScienceContext;
  domain: DomainKey;
  label: string;
  category: Category;
  headline: string;
  explanation: string;
  facts: string[];
  evidence: EvidenceItem[];
  observationIds: string[];
  historyRefs: string[];
  ruleIds: string[];
  assumptions: string[];
  dataGaps: string[];
  uncertainty: string[];
  preventive: PreventiveSuggestion[];
  nextCheck: NextCheck | null;
  references: ReferenceKey[];
  metrics: MetricSnapshot[];
  freshness: {
    newest: string | null;
    status: "fresh" | "stale" | "missing";
    label: string;
  };
  completeness: { available: number; total: number };
};

export type BaselineSummary = {
  metric: MetricKey;
  label: string;
  unit: string;
  mean: number | null;
  sampleCount: number;
  windowDays: number;
  latestValue: number | null;
  delta: number | null;
  note: string;
};

export type AssessmentBundle = {
  spaceContext: SpaceContextReport;
  crew: CrewProfile;
  mission: MissionSettings | null;
  stream: {
    id: string;
    label: string;
    scenario: ScenarioKey | null;
    kind: "baseline" | "simulated";
  } | null;
  ruleSetVersion: string;
  assessedAt: string;
  timezoneLabel: string;
  overallCategory: Category;
  domains: DomainAssessment[];
  completeness: { available: number; total: number; missing: MetricKey[] };
  dataGaps: string[];
  nextStep: {
    title: string;
    detail: string;
    domain: DomainKey;
    category: Category;
    check: NextCheck | null;
    openCaseId: string | null;
  } | null;
  baselines: BaselineSummary[];
  missionInfluences: string[];
};

/* ------------------------------------------------------------------ cases */

export type CaseStatus = "open" | "monitoring" | "archived";

export type CaseRecord = {
  id: string;
  crewId: string;
  crewName: string;
  domain: DomainKey;
  domainLabel: string;
  title: string;
  status: CaseStatus;
  currentCategory: Category;
  openedAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archiveReason: string | null;
  streamId: string | null;
  snapshot: DomainAssessment | null;
  ruleSetVersion: string;
  eventCount: number;
  acknowledgedAt: string | null;
  handoverIds: string[];
};

export type CaseEventKind =
  | "opened"
  | "category_change"
  | "observation_added"
  | "check_completed"
  | "check_declined"
  | "note"
  | "action"
  | "review_requested"
  | "acknowledged"
  | "handover_queued"
  | "handover_reply"
  | "archived";

export type CaseEvent = {
  id: string;
  caseId: string;
  kind: CaseEventKind;
  title: string;
  body: string;
  occurredAt: string;
  actor: "crew_mode" | "ground_simulation" | "system";
  data: Record<string, unknown> | null;
};

/* --------------------------------------------------------- guided checks */

export type GuidedCheckStatus = "open" | "completed" | "unable" | "superseded";

export type GuidedCheck = {
  id: string;
  crewId: string;
  caseId: string | null;
  domain: DomainKey;
  metric: MetricKey;
  prompt: string;
  reason: string;
  ruleIds: string[];
  status: GuidedCheckStatus;
  createdAt: string;
  completedAt: string | null;
  unableReason: string | null;
  observationId: string | null;
  streamId: string | null;
  urgency: "routine" | "priority";
};

/* ------------------------------------------------------------- simulator */

export type SimulationRun = {
  id: string;
  crewId: string;
  scenario: ScenarioKey;
  label: string;
  seed: number;
  createdAt: string;
  status: "generated" | "active" | "archived";
  startDate: string;
  dayCount: number;
  assumptions: string[];
  preview: ScenarioPreviewRow[];
  ruleSetVersion: string;
};

export type ScenarioPreviewRow = {
  metric: MetricKey;
  label: string;
  unit: string;
  baseline: string;
  target: string;
  direction: "up" | "down" | "flat";
  note: string;
};

export type SimulationComparison = {
  run: SimulationRun;
  day: number;
  baselineDomains: DomainAssessment[];
  scenarioDomains: DomainAssessment[];
  categoryChanges: {
    domain: DomainKey;
    label: string;
    from: Category;
    to: Category;
    reason: string;
  }[];
  assessedAt: string;
  readOnly: boolean;
};

/* ------------------------------------------------------------------ link */

export type HandoverStatus =
  | "draft"
  | "queued"
  | "sent"
  | "delivered"
  | "reply_in_transit"
  | "reply_received";

export type HandoverReply = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  arrivesAt: string;
  status: "in_transit" | "received";
  disclaimer: string;
};

export type HandoverSnapshot = {
  streamId?: string | null;
  scientificSources?: ScienceSource[];
  spaceContext?: SpaceContextReport;
  scientificContext?: ScienceContext | null;
  crewId: string;
  crewName: string;
  caseId: string | null;
  caseTitle: string | null;
  domain: DomainKey | null;
  category: Category;
  categoryLabel: string;
  mission: MissionSettings | null;
  ruleSetVersion: string;
  assessedAt: string;
  streamLabel: string | null;
  evidence: EvidenceItem[];
  dataGaps: string[];
  explanation: string;
  recordedActions: string[];
  followUpQuestions: string[];
  disclaimer: string;
};

export type HandoverEvent = {
  id: string;
  handoverId: string;
  status: HandoverStatus;
  occurredAt: string;
  note: string;
  actor: "crew_mode" | "ground_simulation" | "system";
};

export type Handover = {
  id: string;
  caseId: string | null;
  crewId: string;
  crewName: string;
  domain: DomainKey | null;
  category: Category;
  status: HandoverStatus;
  version: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  queuedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  replyReceivedAt: string | null;
  oneWayDelayMinutes: number;
  groundReviewMinutes: number;
  snapshot: HandoverSnapshot | null;
  events: HandoverEvent[];
  reply: HandoverReply | null;
  replyReleased: boolean;
  nextLeg: { label: string; dueAt: string | null; detail: string } | null;
};

export type LinkState = {
  oneWayDelayMinutes: number;
  groundReviewMinutes: number;
  linkAvailable: boolean;
  virtualClock: string;
  realClock: string;
  note: string;
};

/* ----------------------------------------------------------------- import */

export type ImportFieldKey =
  | "crewId"
  | "crewName"
  | "observedAt"
  | "unit"
  | "context"
  | "sourceLabel"
  | "note"
  | MetricKey;

export type ImportColumnMapping = {
  column: string;
  field: ImportFieldKey | "ignore";
  unit: string | null;
  confidence: "suggested" | "manual" | "unmapped";
  reason: string;
};

export type ImportRowError = {
  row: number;
  column: string | null;
  field: ImportFieldKey | null;
  code:
    | "required"
    | "type"
    | "range"
    | "enum"
    | "identity"
    | "timestamp"
    | "unit"
    | "duplicate"
    | "unsupported";
  message: string;
  expected: string;
};

export type ImportPreviewRow = {
  row: number;
  crewId: string | null;
  crewName: string;
  metric: MetricKey | null;
  value: string;
  unit: string;
  observedAt: string | null;
  context: string | null;
  status: "valid" | "invalid" | "duplicate";
};

export type ImportBatch = {
  id: string;
  sourceTitle: string;
  sourceRef: string;
  format: "csv" | "json";
  status: "preview" | "committed" | "failed";
  createdAt: string;
  rowCount: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  mapping: ImportColumnMapping[];
  originalColumns: string[];
  recordPath: string | null;
  errors: ImportRowError[];
  preview: ImportPreviewRow[];
  committedCount: number;
  allowPartial: boolean;
  notes: string[];
  checksum: string;
};

/* ------------------------------------------------------------- assistant */

export type AssistantIntent =
  | "space_hazards"
  | "radiation_context"
  | "research_evidence"
  | "mission_context"
  | "what_is_wrong"
  | "future_risks"
  | "why_at_risk"
  | "prevent_complications"
  | "next_step"
  | "treatment_support"
  | "who_first"
  | "eva_readiness"
  | "why_category"
  | "gaps"
  | "unsupported";

export type AssistantSource = {
  label: string;
  note: string;
  url: string | null;
};

export type AssistantAction = {
  label: string;
  route: string;
  kind: "check" | "evidence" | "care" | "mission" | "case" | "assistant";
};

export type AssistantAnswer = {
  intent: AssistantIntent;
  intentLabel: string;
  summary: string;
  facts: string[];
  gaps: string[];
  uncertainty: string[];
  nextAction: { label: string; detail: string; route: string } | null;
  sources: AssistantSource[];
  actions: AssistantAction[];
  followUps: string[];
  context: {
    crewId: string;
    crewName: string;
    streamLabel: string | null;
    ruleSetVersion: string;
    assessedAt: string;
  };
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  answer: AssistantAnswer | null;
  createdAt: string;
};

/* ------------------------------------------------------------------ misc */

export type AppState = {
  appliedMissionId: string | null;
  draftMissionId: string | null;
  activeStreamId: string | null;
  activeStreamCrewId: string | null;
  link: LinkState;
  seedVersion: string;
  updatedAt: string;
};

export type CrewWideRow = {
  hazardGaps: string[];
  workflowChecks: string[];
  crewId: string;
  crewName: string;
  callSign: string;
  category: Category;
  headline: string;
  concerns: string[];
  reasons: string[];
  dataGaps: string[];
  nextAction: string;
  openCaseCount: number;
  completeness: { available: number; total: number };
  domainCategories: { domain: DomainKey; label: string; category: Category }[];
};
