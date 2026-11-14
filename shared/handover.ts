import { REFERENCE_LIBRARY } from "./constants";
/**
 * Deep Space Link — delayed-communication handover state machine.
 *
 * Everything is local and labelled as a simulation. The virtual link clock is separate from
 * observation time: advancing it never refreshes, ages or fabricates clinical observations.
 */
import { CATEGORY_META, type Category, type DomainKey } from "./constants";
import type {
  AssessmentBundle,
  CaseRecord,
  HandoverSnapshot,
  HandoverStatus,
  LinkState,
  MissionSettings,
} from "./domain";

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  draft: "Draft",
  queued: "Queued (link outage)",
  sent: "Sent in simulation",
  delivered: "Delivered in simulation",
  reply_in_transit: "Reply in transit",
  reply_received: "Reply received in simulation",
};

export const HANDOVER_SEQUENCE: HandoverStatus[] = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "reply_in_transit",
  "reply_received",
];

const TRANSITIONS: Record<HandoverStatus, HandoverStatus[]> = {
  draft: ["queued"],
  queued: ["sent"],
  sent: ["delivered"],
  delivered: ["reply_in_transit"],
  reply_in_transit: ["reply_received"],
  reply_received: [],
};

export function allowedTransitions(status: HandoverStatus): HandoverStatus[] {
  return TRANSITIONS[status];
}

export function canTransition(
  from: HandoverStatus,
  to: HandoverStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionError(
  from: HandoverStatus,
  to: HandoverStatus,
): string {
  return `Invalid transition ${from} → ${to}. Allowed from ${from}: ${
    TRANSITIONS[from].length > 0
      ? TRANSITIONS[from].join(", ")
      : "none (terminal state)"
  }.`;
}

export type Timing = {
  queuedAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  replyCreatedAt?: string | null;
  replyArrivesAt?: string | null;
  oneWayDelayMinutes: number;
  groundReviewMinutes: number;
  linkAvailable: boolean;
};

export type ScheduledTransition = {
  status: HandoverStatus;
  occurredAt: string;
  note: string;
};

function addMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

/**
 * Returns the transitions that the virtual clock has already passed. Nothing is invented: each
 * transition is derived from a stored timestamp plus the configured delay legs.
 */
export function scheduledTransitions(
  status: HandoverStatus,
  timing: Timing,
  virtualClock: string,
): ScheduledTransition[] {
  const clock = new Date(virtualClock).getTime();
  const past = (value: string | null | undefined): value is string =>
    Boolean(value) && new Date(value as string).getTime() <= clock;

  if (status === "queued") {
    if (!timing.linkAvailable) return [];
    const dueAt = timing.queuedAt ?? virtualClock;
    if (!past(dueAt)) return [];
    return [
      {
        status: "sent",
        occurredAt: virtualClock,
        note: `Link restored: outbound leg started. One-way delay ${timing.oneWayDelayMinutes} min.`,
      },
    ];
  }

  if (status === "sent") {
    if (!timing.sentAt) return [];
    const dueAt = addMinutes(timing.sentAt, timing.oneWayDelayMinutes);
    if (!past(dueAt)) return [];
    return [
      {
        status: "delivered",
        occurredAt: dueAt,
        note: `Outbound leg complete after ${timing.oneWayDelayMinutes} min of simulated one-way delay. Delivery is not medical review.`,
      },
    ];
  }

  if (status === "reply_in_transit") {
    if (!timing.replyArrivesAt) return [];
    if (!past(timing.replyArrivesAt)) return [];
    return [
      {
        status: "reply_received",
        occurredAt: timing.replyArrivesAt,
        note: "Return leg complete: the fictional ground reply is released on the crew side.",
      },
    ];
  }

  return [];
}

export function nextLeg(
  status: HandoverStatus,
  timing: Timing,
  virtualClock: string,
): { label: string; dueAt: string | null; detail: string } | null {
  const clock = new Date(virtualClock).getTime();
  switch (status) {
    case "draft":
      return {
        label: "Not queued",
        dueAt: null,
        detail:
          "Queue the handover to freeze its evidence snapshot. It can only be dispatched while the simulated link is available.",
      };
    case "queued":
      return {
        label: timing.linkAvailable ? "Outbound leg ready" : "Holding for link",
        dueAt: timing.queuedAt ?? null,
        detail: timing.linkAvailable
          ? "The simulated link is available; advance the virtual clock to start the outbound leg."
          : "The simulated link is unavailable. The snapshot stays queued; advancing the clock does not age observations.",
      };
    case "sent":
      return {
        label: "Outbound leg in flight",
        dueAt: timing.sentAt
          ? addMinutes(timing.sentAt, timing.oneWayDelayMinutes)
          : null,
        detail: `One-way delay ${timing.oneWayDelayMinutes} min. Arrival at ${new Date(
          (timing.sentAt ? new Date(timing.sentAt).getTime() : clock) +
            timing.oneWayDelayMinutes * 60_000,
        ).toISOString()}.`,
      };
    case "delivered":
      return {
        label: "Awaiting simulated ground review",
        dueAt: null,
        detail: `The fictional ground team may take about ${timing.groundReviewMinutes} min of separate review time. Delivery never means reviewed, treated or cleared.`,
      };
    case "reply_in_transit":
      return {
        label: "Return leg in flight",
        dueAt: timing.replyArrivesAt ?? null,
        detail:
          "The reply stays hidden from the crew side until the return journey completes.",
      };
    case "reply_received":
      return {
        label: "Simulation complete",
        dueAt: null,
        detail:
          "A fictional reply was received. It carries no clinical authority and is labelled as a simulation.",
      };
    default:
      return null;
  }
}

export function buildHandoverSnapshot(params: {
  bundle: AssessmentBundle;
  domain: DomainKey | null;
  category: Category;
  caseRecord: CaseRecord | null;
  mission: MissionSettings | null;
  recordedActions: string[];
  followUpQuestions: string[];
}): HandoverSnapshot {
  const {
    bundle,
    domain,
    category,
    caseRecord,
    mission,
    recordedActions,
    followUpQuestions,
  } = params;
  const domainAssessment = domain
    ? (bundle.domains.find((item) => item.domain === domain) ?? null)
    : null;
  return {
    streamId: bundle.stream?.id ?? null,
    scientificSources: (
      domainAssessment?.references ?? [
        "nasaHazards",
        "nasaRisks",
        "csaRadiation",
        "csaDeepSpace",
      ]
    ).map((key) => ({
      ...REFERENCE_LIBRARY[key as keyof typeof REFERENCE_LIBRARY],
    })),
    spaceContext: bundle.spaceContext,
    scientificContext: domainAssessment?.scientificContext ?? null,
    crewId: bundle.crew.id,
    crewName: bundle.crew.displayName,
    caseId: caseRecord?.id ?? null,
    caseTitle: caseRecord?.title ?? null,
    domain,
    category,
    categoryLabel: CATEGORY_META[category].label,
    mission,
    ruleSetVersion: bundle.ruleSetVersion,
    assessedAt: bundle.assessedAt,
    streamLabel: bundle.stream?.label ?? null,
    evidence:
      domainAssessment?.evidence ??
      bundle.domains.flatMap((item) => item.evidence).slice(0, 8),
    dataGaps: domainAssessment?.dataGaps ?? bundle.dataGaps,
    explanation:
      domainAssessment?.explanation ??
      bundle.nextStep?.detail ??
      "No demonstration concern is open.",
    recordedActions,
    followUpQuestions,
    disclaimer:
      "SIMULATION ONLY. This handover was produced by a local demonstration app. It is not a real transmission, not a medical record and not medical advice. Delivery does not mean the case was reviewed, treated or cleared.",
  };
}

export function linkLabel(link: LinkState): string {
  return `${link.linkAvailable ? "Link available (simulated)" : "Link unavailable (simulated)"} · one-way ${link.oneWayDelayMinutes} min · virtual clock ${new Date(
    link.virtualClock,
  )
    .toISOString()
    .slice(11, 16)} UTC`;
}
