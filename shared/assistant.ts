import { logSummary } from "./mission-context";
/**
 * Baymax Assistant — local, deterministic explanations.
 *
 * No network model, no paid API. Intent recognition is keyword based, and every answer is composed
 * from the shared assessment bundle for the selected crew, mission and stream.
 */
import {
  RULE_SET_VERSION,
  CATEGORY_META,
  DOMAINS,
  METRICS,
  REFERENCE_LIBRARY,
  worstCategory,
  type Category,
  type DomainKey,
} from "./constants";
import type {
  AssessmentBundle,
  AssistantAction,
  AssistantAnswer,
  AssistantIntent,
  CrewWideRow,
  DomainAssessment,
} from "./domain";
import { formatDateTime, pluralize } from "./format";

export const SUPPORTED_QUESTIONS = [
  "Which spaceflight hazards have missing information?",
  "What radiation records are available?",
  "Which NASA sources support this concern?",
  "What mission context should I record?",
  "What is wrong with this astronaut?",
  "What problems might occur in the future?",
  "Why is this astronaut at risk?",
  "How can we prevent complications?",
  "What should this astronaut do next?",
  "What treatment support is available?",
  "Who requires medical attention first?",
  "Is this astronaut ready for a spacewalk?",
  "Why was this review category assigned?",
];

/** Short chips shown above the composer. */
export const ANSWER_STARTERS = [
  "Why was this review category assigned?",
  "What should this astronaut do next?",
  "Who requires medical attention first?",
];

type IntentRule = {
  intent: AssistantIntent;
  label: string;
  patterns: RegExp[];
};

const INTENT_RULES: IntentRule[] = [
  {
    intent: "who_first",
    label: "Crew prioritisation",
    patterns: [
      /\bwho (requires|needs|should)\b/,
      /\bwho (is|are) (first|worst|most at risk)\b/,
      /\b(first|priority) (attention|review)\b/,
      /\bprioriti[sz]e\b/,
      /\btriage\b/,
      /\bmost urgent\b/,
    ],
  },
  {
    intent: "eva_readiness",
    label: "EVA readiness",
    patterns: [/\beva\b/, /space ?walk/, /extravehicular/],
  },
  {
    intent: "why_category",
    label: "Why this category",
    patterns: [
      /why (was|is|has) (this|the) (review )?(category|review|flag|status)/,
      /why (is|was) (this|he|she|they) (flagged|in review|priority)/,
      /what (does|do) (priority review|review before assignment|more data needed|no demo flags) mean/,
      /why (priority|review)/,
    ],
  },
  {
    intent: "future_risks",
    label: "What might occur",
    patterns: [
      /future/,
      /what (problems|issues|risks) (might|could|may|will)/,
      /what (might|could) happen/,
      /prognos/,
      /later in the mission/,
      /will (he|she|they) get/,
    ],
  },
  {
    intent: "why_at_risk",
    label: "Why flagged",
    patterns: [
      /why (is|are|was|were)/,
      /what (caused|triggered|drove)/,
      /reason (for|why)/,
      /justify/,
    ],
  },
  {
    intent: "prevent_complications",
    label: "Prevention",
    patterns: [
      /prevent/,
      /avoid/,
      /complication/,
      /reduce (the )?risk/,
      /mitigat/,
    ],
  },
  {
    intent: "next_step",
    label: "Next step",
    patterns: [
      /what (should|do) (this astronaut|he|she|they|we)/,
      /next step/,
      /what now/,
      /what do we do/,
    ],
  },
  {
    intent: "treatment_support",
    label: "Treatment support",
    patterns: [
      /treatment/,
      /medicat/,
      /dose/,
      /cure/,
      /therapy/,
      /care (support|plan)/,
      /painkiller/,
    ],
  },
  {
    intent: "gaps",
    label: "Missing information",
    patterns: [
      /missing/,
      /data gap/,
      /unknown/,
      /incomplete/,
      /not recorded/,
      /no data/,
    ],
  },
  {
    intent: "what_is_wrong",
    label: "Current concern",
    patterns: [
      /what('s| is) wrong/,
      /what('s| is) (the )?(problem|concern|matter)/,
      /diagnos/,
      /what (does|do) (he|she|they) have/,
      /is (he|she|they) (sick|ill|ok|okay|healthy)/,
      /what happened/,
    ],
  },
];

const DOMAIN_KEYWORDS: Record<DomainKey, string[]> = {
  cardiovascular: [
    "heart",
    "cardio",
    "cardiac",
    "blood pressure",
    "pulse",
    "hypertension",
  ],
  boneHealth: ["bone", "fracture", "density", "osteoporosis"],
  muscleConditioning: ["muscle", "strength", "conditioning", "atrophy"],
  sleepRestriction: ["sleep", "insomnia", "rest"],
  fatigue: ["fatigue", "tired", "exhaust", "drowsy"],
  visionChange: ["vision", "eye", "sight", "visual", "blurr"],
  stressWellbeing: [
    "stress",
    "wellbeing",
    "well-being",
    "anxiety",
    "mental",
    "mood",
  ],
  respiratory: [
    "respiratory",
    "breathing",
    "breath",
    "oxygen",
    "spo2",
    "lung",
    "asthma",
  ],
};

export function detectIntent(question: string): {
  intent: AssistantIntent;
  label: string;
} {
  const normalized = question.toLowerCase();
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return { intent: rule.intent, label: rule.label };
    }
  }
  return {
    intent: "unsupported",
    label: "Not supported by the local assistant",
  };
}

export function resolveDomain(
  question: string,
  bundle: AssessmentBundle,
): DomainAssessment {
  const normalized = question.toLowerCase();
  for (const domain of bundle.domains) {
    const keywords = DOMAIN_KEYWORDS[domain.domain];
    if (keywords.some((keyword) => normalized.includes(keyword))) return domain;
  }
  return bundle.domains[0];
}

function domainRoute(domain: DomainKey, crewId: string): string {
  return `/assessment/${domain}?crewId=${encodeURIComponent(crewId)}`;
}

function careRoute(domain: DomainKey, crewId: string): string {
  return `/care/${domain}?crewId=${encodeURIComponent(crewId)}`;
}

function checkRoute(
  bundle: AssessmentBundle,
  domain: DomainAssessment,
): string {
  const metric = domain.nextCheck?.metric ?? "heartRate";
  return `/check/new?crewId=${encodeURIComponent(bundle.crew.id)}&domain=${domain.domain}&metric=${metric}`;
}

function topDomains(
  bundle: AssessmentBundle,
  limit: number,
): DomainAssessment[] {
  return bundle.domains
    .filter((domain) => domain.category !== "no_flags")
    .slice(0, limit);
}

function categoryLine(domain: DomainAssessment): string {
  return `${CATEGORY_META[domain.category].label} — ${domain.label}: ${domain.headline}`;
}

function sourcesFor(domain: DomainAssessment): AssistantAnswer["sources"] {
  return domain.references.map((key) => ({
    label: REFERENCE_LIBRARY[key].title,
    note: REFERENCE_LIBRARY[key].supports,
    url: REFERENCE_LIBRARY[key].url,
  }));
}

function baseActions(
  bundle: AssessmentBundle,
  domain: DomainAssessment,
): AssistantAction[] {
  const actions: AssistantAction[] = [
    {
      label: "Start useful check",
      route: checkRoute(bundle, domain),
      kind: "check",
    },
    {
      label: "Show evidence",
      route: domainRoute(domain.domain, bundle.crew.id),
      kind: "evidence",
    },
    {
      label: "Open care support",
      route: careRoute(domain.domain, bundle.crew.id),
      kind: "care",
    },
    { label: "View mission review", route: "/mission", kind: "mission" },
  ];
  if (bundle.nextStep?.openCaseId) {
    actions.push({
      label: "Open case",
      route: `/cases/${bundle.nextStep.openCaseId}`,
      kind: "case",
    });
  }
  return actions;
}

function context(bundle: AssessmentBundle): AssistantAnswer["context"] {
  return {
    crewId: bundle.crew.id,
    crewName: bundle.crew.displayName,
    streamLabel: bundle.stream?.label ?? null,
    ruleSetVersion: bundle.ruleSetVersion,
    assessedAt: bundle.assessedAt,
  };
}

function describeValue(
  domain: DomainAssessment,
  metric: keyof typeof METRICS,
): string | null {
  const snapshot = domain.metrics.find((item) => item.metric === metric);
  if (!snapshot || !snapshot.value) return null;
  const parts = [`${snapshot.label} ${snapshot.value}`];
  if (snapshot.observedAt) parts.push(formatDateTime(snapshot.observedAt));
  if (snapshot.sourceLabel) parts.push(snapshot.sourceLabel);
  if (snapshot.context) parts.push(snapshot.context.replace(/_/g, " "));
  return parts.join(" · ");
}

function leadReason(domain: DomainAssessment): string {
  return domain.headline.replace(/\.$/, "");
}

function gapsFor(
  bundle: AssessmentBundle,
  domain: DomainAssessment,
  limit = 4,
): string[] {
  const combined = [
    ...domain.dataGaps,
    ...bundle.dataGaps.filter((gap) => !domain.dataGaps.includes(gap)),
  ];
  const unique = Array.from(new Set(combined.filter(Boolean)));
  if (unique.length === 0) {
    return [
      "No missing fields were detected for the metrics this domain screens.",
    ];
  }
  return unique.slice(0, limit);
}

function uncertaintyFor(domain: DomainAssessment): string[] {
  const items = [
    ...domain.uncertainty,
    `${CATEGORY_META[domain.category].label} is a demonstration screening label, not a clinical judgement.`,
    `Rule set ${RULE_SET_VERSION} applies illustrative thresholds; see RULES_AND_LIMITATIONS.md.`,
  ];
  return items.slice(0, 4);
}

function summaryFor(
  bundle: AssessmentBundle,
  domain: DomainAssessment,
): string {
  const meta = CATEGORY_META[domain.category];
  const overall = CATEGORY_META[bundle.overallCategory];
  if (domain.category === "no_flags") {
    return `${bundle.crew.displayName}: no demonstration flag in ${domain.label.toLowerCase()}. ${meta.meaning} The crew-wide picture is ${overall.label.toLowerCase()}.`;
  }
  if (domain.category === "more_data") {
    return `${bundle.crew.displayName}: ${domain.label.toLowerCase()} cannot be screened yet because information is missing. ${leadReason(domain)}.`;
  }
  return `${bundle.crew.displayName} is flagged ${meta.label} for ${domain.label.toLowerCase()}: ${leadReason(domain)}.`;
}

function answerRecordQuestion(params: {
  question: string;
  bundle: AssessmentBundle;
  crewTable?: CrewWideRow[];
}): AssistantAnswer {
  const { question, bundle } = params;
  const crewTable = params.crewTable ?? [];
  const { intent, label } = detectIntent(question);
  const domain = resolveDomain(question, bundle);
  const followUps = SUPPORTED_QUESTIONS.filter(
    (item) => item.toLowerCase() !== question.toLowerCase(),
  ).slice(0, 4);

  if (intent === "unsupported") {
    return {
      intent,
      intentLabel: label,
      summary:
        "This local assistant only explains the selected demonstration record. It cannot answer general medical questions, give a diagnosis, recommend medication or invent data.",
      facts: [
        `Selected record: ${bundle.crew.displayName}, ${bundle.stream?.label ?? "baseline data"}.`,
        `Current crew-wide category: ${CATEGORY_META[bundle.overallCategory].label}.`,
      ],
      gaps: gapsFor(bundle, domain, 3),
      uncertainty: [
        "No language model is used. Answers come from predefined intent templates and the shared screening engine.",
      ],
      nextAction: {
        label: "Ask about the selected record",
        detail:
          "Try one of the supported questions below — for example why the crew member is flagged, or what to do next.",
        route: "/assistant",
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "who_first") {
    const rows = [...crewTable].sort(
      (left, right) =>
        CATEGORY_META[left.category].order -
        CATEGORY_META[right.category].order,
    );
    const priority = rows.filter((row) => row.category === "priority");
    const review = rows.filter((row) => row.category === "review");
    const moreData = rows.filter((row) => row.category === "more_data");
    const facts = rows.slice(0, 5).map((row) => {
      const concerns =
        row.concerns.length > 0
          ? row.concerns.join(", ")
          : "no demonstration concerns";
      const gap =
        row.dataGaps.length > 0
          ? ` Missing: ${row.dataGaps.slice(0, 2).join("; ")}`
          : " No missing fields detected.";
      return `${row.crewName} — ${CATEGORY_META[row.category].label}: ${concerns}.${gap}`;
    });
    return {
      intent,
      intentLabel: label,
      summary:
        rows.length === 0
          ? "No crew records are available yet, so no prioritisation can be produced."
          : `${priority.length} crew member${priority.length === 1 ? "" : "s"} in Priority Review, ${review.length} in Review Before Assignment, ${moreData.length} needing more data. This ordering matches the Mission Readiness table and does not replace medical triage.`,
      facts,
      gaps: [
        ...new Set(rows.flatMap((row) => row.dataGaps).slice(0, 4)),
        ...(rows.length === 0 ? ["No crew profiles are loaded."] : []),
      ],
      uncertainty: [
        "Crew with missing information are ranked as 'More Data Needed'; unknown data never produces a reassuring result.",
        "Ranking reflects demonstration rules only — authorised medical personnel decide actual review order.",
      ],
      nextAction: {
        label: "Open mission review",
        detail:
          "The full table shows each crew member's category, concerns, reasons, gaps and next action.",
        route: "/mission",
      },
      sources: sourcesFor(domain),
      actions: [
        { label: "View mission review", route: "/mission", kind: "mission" },
        {
          label: "Show evidence",
          route: domainRoute(domain.domain, bundle.crew.id),
          kind: "evidence",
        },
      ],
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "eva_readiness") {
    const relevant = bundle.domains.filter(
      (item) =>
        item.domain === "cardiovascular" ||
        item.domain === "respiratory" ||
        item.domain === "visionChange",
    );
    const evaCategory = worstCategory(relevant.map((item) => item.category));
    const facts = relevant.map((item) => categoryLine(item));
    return {
      intent,
      intentLabel: label,
      summary: `EVA clearance cannot be given by this app. On the current demonstration record, the EVA-relevant screens resolve to ${CATEGORY_META[evaCategory].label}. ${
        bundle.mission?.evaRequired
          ? "The applied mission requires EVA, so current resting heart rate, oxygen saturation and a vision report are expected before review."
          : "The applied mission does not require EVA; the same review still applies if it is added."
      }`,
      facts,
      gaps: gapsFor(bundle, domain, 4),
      uncertainty: [
        "EVA authorisation requires authorised medical and mission review, independent of this screening output.",
        "Demonstration thresholds are not EVA medical standards and were not derived from a flight rule.",
      ],
      nextAction: {
        label: "Record the pre-EVA checks",
        detail: `Next useful check: ${domain.nextCheck?.prompt ?? "resting cardiovascular measurements"}.`,
        route: checkRoute(bundle, domain),
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "why_category" || intent === "why_at_risk") {
    return {
      intent,
      intentLabel: label,
      summary: summaryFor(bundle, domain),
      facts: [
        ...domain.facts.slice(0, 4),
        `Rules applied: ${domain.ruleIds.join(", ")}.`,
        `Category: ${CATEGORY_META[domain.category].label} — ${CATEGORY_META[domain.category].meaning}`,
      ],
      gaps: gapsFor(bundle, domain),
      uncertainty: uncertaintyFor(domain),
      nextAction: {
        label: domain.nextCheck?.prompt ?? "Open the evidence view",
        detail:
          domain.nextCheck?.reason ??
          "The evidence view lists every value, date, unit and source used.",
        route: domain.nextCheck
          ? checkRoute(bundle, domain)
          : domainRoute(domain.domain, bundle.crew.id),
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "what_is_wrong") {
    return {
      intent,
      intentLabel: label,
      summary: `${summaryFor(bundle, domain)} This describes observed demonstration concerns, not a diagnosis.`,
      facts: [
        ...domain.facts.slice(0, 4),
        `Crew-wide category: ${CATEGORY_META[bundle.overallCategory].label}.`,
      ],
      gaps: gapsFor(bundle, domain),
      uncertainty: uncertaintyFor(domain),
      nextAction: {
        label: "Review the evidence with a clinician",
        detail:
          "Anything that looks clinical should be assessed by the responsible medical officer; this app records and explains data only.",
        route: domainRoute(domain.domain, bundle.crew.id),
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "future_risks") {
    const others = topDomains(bundle, 3).filter(
      (item) => item.domain !== domain.domain,
    );
    return {
      intent,
      intentLabel: label,
      summary:
        "This app does not predict future disease. It can describe which monitored areas are currently flagged and what would make them easier to detect early.",
      facts: [
        categoryLine(domain),
        ...others.map((item) => categoryLine(item)),
        `Monitored signals: ${bundle.domains.map((item) => item.label.toLowerCase()).join(", ")}.`,
      ],
      gaps: gapsFor(bundle, domain),
      uncertainty: [
        "No trained model is used and no probability is calculated; longer missions change exposure, not a prediction.",
        "Screening thresholds are demonstration settings, so 'what might occur' is limited to the eight monitored domains.",
      ],
      nextAction: {
        label: "Close the biggest data gap",
        detail:
          bundle.completeness.missing.length > 0
            ? `${pluralize(bundle.completeness.missing.length, "field")} unavailable: ${bundle.completeness.missing
                .map((metric) => METRICS[metric].label.toLowerCase())
                .join(", ")}.`
            : "All eight relevant fields are current; continue scheduled monitoring.",
        route: checkRoute(bundle, domain),
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "prevent_complications") {
    return {
      intent,
      intentLabel: label,
      summary: `Preventive support for ${domain.label.toLowerCase()} is built from the current evidence and your saved history; it is not a treatment protocol.`,
      facts: domain.preventive
        .map((item) => `${item.title} — ${item.reason}`)
        .slice(0, 4),
      gaps: gapsFor(bundle, domain),
      uncertainty: uncertaintyFor(domain),
      nextAction: {
        label: "Open care support",
        detail:
          "Care support shows what the finding may and may not mean, educational first aid and when to seek review.",
        route: careRoute(domain.domain, bundle.crew.id),
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "next_step") {
    const step = bundle.nextStep;
    return {
      intent,
      intentLabel: label,
      summary: step ? step.title : "No next step is available for this record.",
      facts: [
        step?.detail ?? "No demonstration flag or gap is currently open.",
        ...domain.facts.slice(0, 2),
        `Completeness: ${bundle.completeness.available} of ${bundle.completeness.total} relevant fields available.`,
      ],
      gaps: gapsFor(bundle, domain),
      uncertainty: [
        "One next step is shown at a time by design; it is the highest-ranked demonstration action, not a clinical priority order.",
      ],
      nextAction: {
        label: step?.check?.prompt ?? "Record an observation",
        detail:
          step?.check?.reason ??
          "Recording a current value keeps the screening meaningful.",
        route: step?.check
          ? checkRoute(bundle, domain)
          : `/observation/new?crewId=${bundle.crew.id}`,
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  if (intent === "treatment_support") {
    return {
      intent,
      intentLabel: label,
      summary:
        "The app does not prescribe medication, give doses or provide an approved clinical protocol. It does provide educational treatment support: what may help, what to monitor, and when review is needed.",
      facts: [
        ...domain.preventive
          .slice(0, 3)
          .map((item) => `${item.title} — ${item.detail}`),
        `Emergency boundary: ${CATEGORY_META[domain.category].instruction}`,
      ],
      gaps: gapsFor(bundle, domain),
      uncertainty: [
        "No mission-approved clinical protocol was supplied, so every protocol record in care support is marked unapproved.",
        "Any medication decision belongs to authorised medical personnel.",
      ],
      nextAction: {
        label: "Open care support",
        detail:
          "Educational first aid, follow-up observations and the unapproved protocol structure are listed per concern.",
        route: careRoute(domain.domain, bundle.crew.id),
      },
      sources: sourcesFor(domain),
      actions: baseActions(bundle, domain),
      followUps,
      context: context(bundle),
    };
  }

  // gaps
  return {
    intent: "gaps",
    intentLabel: label,
    summary: `Completeness is ${bundle.completeness.available} of ${bundle.completeness.total} relevant fields available. Missing information is reported separately from the review category.`,
    facts: [
      bundle.completeness.missing.length > 0
        ? `Unavailable fields: ${bundle.completeness.missing.map((metric) => METRICS[metric].label).join(", ")}.`
        : "All eight relevant fields have a current value.",
      ...bundle.domains
        .filter((item) => item.freshness.status !== "fresh")
        .slice(0, 3)
        .map((item) => `${item.label}: ${item.freshness.label}.`),
    ],
    gaps: gapsFor(bundle, domain),
    uncertainty: [
      "Missing values are never replaced with zero, and stale values are not treated as current.",
    ],
    nextAction: {
      label: "Fill the highest-value gap",
      detail:
        domain.nextCheck?.reason ??
        "Record the next useful check to reduce uncertainty.",
      route: checkRoute(bundle, domain),
    },
    sources: sourcesFor(domain),
    actions: baseActions(bundle, domain),
    followUps,
    context: context(bundle),
  };
}

export function categorySummaryText(categories: Category[]): string {
  if (categories.length === 0) return "No domains available.";
  const overall = worstCategory(categories);
  return CATEGORY_META[overall].label;
}

/** Source-aware wrapper; all clinical labels still come from the same demonstration engine. */
export function answerQuestion(params: {
  question: string;
  bundle: AssessmentBundle;
  crewTable?: CrewWideRow[];
}): AssistantAnswer {
  const { bundle, question } = params;
  const q = question.toLowerCase();
  const domain = resolveDomain(question, bundle);
  const space = bundle.spaceContext;
  const radiation = /radiation|neutron|dosimetry|\bcans\b/.test(q);
  const hazards = /hazard|monitoring coverage/.test(q);
  const research =
    /\bnasa\b|\bcsa\b|reference|\bsource|\bresearch|\bstud(y|ies)\b|\bsans\b/.test(
      q,
    );
  const extraContext =
    /mission context|mission phase|\bgravity\b|\bcabin\b|\bco2\b|carbon dioxide|sleep quality|schedule change|exercise type|symptom onset/.test(
      q,
    );
  if (radiation || hazards || research || extraContext) {
    const logs = radiation
      ? space.logs.filter((l) => l.data.kind === "radiation")
      : space.logs;
    const keys = radiation
      ? (["csaRadiation", "nasaHazards"] as const)
      : hazards
        ? (["nasaHazards", "csaDeepSpace"] as const)
        : extraContext
          ? (["standardMeasures", "hrpSleep"] as const)
          : domain.scientificContext.referenceKeys;
    const sourceFacts = keys.map(
      (k) => `${REFERENCE_LIBRARY[k].title}: ${REFERENCE_LIBRARY[k].supports}`,
    );
    return {
      intent: radiation
        ? "radiation_context"
        : hazards
          ? "space_hazards"
          : research
            ? "research_evidence"
            : "mission_context",
      intentLabel: radiation
        ? "Exposure records"
        : hazards
          ? "Hazard coverage"
          : research
            ? "Scientific evidence"
            : "Mission context",
      summary: radiation
        ? `${bundle.crew.displayName}: ${logs.length} radiation record(s) for the applied mission and selected stream. These are exposure records, not a personal risk prediction or safety clearance.`
        : hazards
          ? "Hazard coverage describes available information. It does not change medical review priority or establish that a hazard is safe."
          : research
            ? `${domain.label}: ${domain.scientificContext.riskTopic} is the relevant research topic. Agency references explain why it matters; the category itself comes from illustrative app rules.`
            : "Phase, gravity, schedule, activity and symptom context help explain observations. Missing context remains unknown and does not authorize demanding activity.",
      facts: radiation
        ? logs
            .slice(0, 4)
            .map(
              (l) =>
                `${logSummary(l)} Interval ${l.data.kind === "radiation" ? l.data.startAt : "unknown"} to ${l.observedAt}; ${l.sourceLabel} (${l.sourceKind}).`,
            )
        : hazards
          ? space.coverage.map(
              (h) =>
                `${h.label}: ${h.status.replace(/_/g, " ")} — ${h.summary}`,
            )
          : research
            ? [...domain.facts.slice(0, 2), ...sourceFacts]
            : [
                ...space.contextFacts,
                ...space.workflowChecks
                  .slice(0, 3)
                  .map((c) => `${c.title}: ${c.reason}`),
              ],
      gaps: radiation
        ? [
            logs.length
              ? "Records do not fully characterize mission exposure."
              : "No exposure record is available; absence of data is not zero exposure.",
            "No personal radiation-risk model or operational exposure limit is implemented.",
          ]
        : hazards
          ? space.coverage.flatMap((h) => h.gaps).slice(0, 5)
          : domain.dataGaps.slice(0, 3),
      uncertainty: [
        "Responses use predefined local logic; no trained model or live medical service is involved.",
        radiation
          ? "No conversions or totals are inferred across units, components, scopes or overlapping intervals. Area and personal measurements stay distinct."
          : domain.scientificContext.boundary,
        "A source supporting monitoring relevance does not validate numeric alert cutoffs. Research interventions are not approved treatment instructions.",
      ],
      sources: keys.map((k) => ({
        label: REFERENCE_LIBRARY[k].title,
        note: `${REFERENCE_LIBRARY[k].supports} Boundary: ${REFERENCE_LIBRARY[k].limitation}`,
        url: REFERENCE_LIBRARY[k].url,
      })),
      nextAction: {
        label: research
          ? "Inspect reference scope"
          : "Record available mission evidence",
        detail: research
          ? "Read the supported claim and its limits alongside the demo rule."
          : "Use the selected crew, mission and stream; manual or simulated records stay labelled.",
        route: research
          ? "/evidence"
          : `/mission-context?kind=${radiation ? "radiation" : "context"}`,
      },
      actions: [
        {
          label: "Hazard coverage",
          route: "/mission-context",
          kind: "evidence",
        },
        { label: "NASA / CSA sources", route: "/evidence", kind: "evidence" },
      ],
      followUps: [
        "Why was this review category assigned?",
        "What should this astronaut do next?",
        "What radiation records are available?",
      ],
      context: context(bundle),
    };
  }
  const answer = answerRecordQuestion(params);
  answer.facts = [
    ...answer.facts,
    `Spaceflight relevance: ${domain.scientificContext.riskTopic}.`,
    ...space.contextFacts.slice(0, 1),
  ];
  answer.uncertainty = [
    ...answer.uncertainty,
    domain.scientificContext.boundary,
    domain.scientificContext.thresholdBasis,
  ];
  answer.actions.push({
    label: "Inspect scientific sources",
    route: "/evidence",
    kind: "evidence",
  });
  return answer;
}
