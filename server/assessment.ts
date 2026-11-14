import { listMissionLogs } from "./mission-log-store";
/**
 * The single server-side assessment service.
 *
 * Every screen, the assistant, the mission table, care support, cases, the simulator comparison
 * and exports call into this module, so screening output can never diverge between screens.
 */
import {
  CATEGORY_META,
  DOMAINS,
  DOMAIN_KEYS,
  METRICS,
  RULE_SET_VERSION,
  type Category,
  type DomainKey,
} from "../shared/constants";
import type {
  AssessmentBundle,
  CaseRecord,
  CrewListItem,
  CrewProfile,
  CrewWideRow,
  DomainAssessment,
  GuidedCheck,
  MissionSettings,
  Observation,
} from "./types";
import { buildAssessment } from "../shared/screening";
import {
  addCaseEvent,
  createCheck,
  findOpenCase,
  getCrew,
  getAppliedMission,
  getRun,
  getState,
  insertCase,
  listCases,
  listChecks,
  listCrew,
  listObservations,
  listObservationsByStream,
  updateCase,
} from "./db";
import type { AppState } from "./types";

export type StreamContext = AssessmentBundle["stream"];

export async function resolveStream(
  crewId: string,
  state?: AppState,
): Promise<StreamContext> {
  const current = state ?? (await getState());
  if (!current.activeStreamId) return null;
  if (current.activeStreamCrewId && current.activeStreamCrewId !== crewId)
    return null;
  const run = await getRun(current.activeStreamId);
  if (!run) return null;
  return {
    id: run.id,
    label: `${run.label}`,
    scenario: run.scenario,
    kind: "simulated",
  };
}

export async function buildBundle(
  crewId: string,
  options: {
    streamId?: string | null;
    observations?: Observation[];
    now?: Date;
    withCaseLinks?: boolean;
  } = {},
): Promise<AssessmentBundle> {
  const crew = await getCrew(crewId);
  if (!crew) throw new Error(`Crew member ${crewId} was not found.`);
  const state = await getState();
  const mission = await getAppliedMission(state);

  let streamId = options.streamId;
  if (streamId === undefined) {
    const stream = await resolveStream(crewId, state);
    streamId = stream?.id ?? null;
  }
  const observations =
    options.observations ??
    (streamId
      ? await listObservations(crewId, streamId)
      : await listObservations(crewId, null));

  const stream = streamId
    ? await (async (): Promise<StreamContext> => {
        const run = await getRun(streamId);
        if (!run) return null;
        return {
          id: run.id,
          label: run.label,
          scenario: run.scenario,
          kind: "simulated",
        };
      })()
    : null;

  let caseMap = new Map<DomainKey, string>();
  if (options.withCaseLinks !== false) {
    const cases = await listCases({ crewId });
    cases
      .filter(
        (item) => item.status !== "archived" && item.streamId === streamId,
      )
      .forEach((item) => {
        if (!caseMap.has(item.domain)) caseMap.set(item.domain, item.id);
      });
  }

  return buildAssessment(
    {
      crew,
      observations,
      missionLogs: await listMissionLogs(crewId, streamId ?? null),
      mission,
      stream,
      now: options.now,
      ruleSetVersion: RULE_SET_VERSION,
    },
    caseMap,
  );
}

export async function buildBaselineBundle(
  crewId: string,
  now?: Date,
): Promise<AssessmentBundle> {
  return buildBundle(crewId, { streamId: null, now, withCaseLinks: false });
}

export async function buildStreamBundle(
  crewId: string,
  streamId: string,
  upToDay?: number,
  now?: Date,
) {
  const observations = await listObservationsByStream(streamId);
  if (upToDay === undefined) {
    return buildBundle(crewId, {
      streamId,
      observations,
      now,
      withCaseLinks: false,
    });
  }
  const distinctDays = Array.from(
    new Set(observations.map((item) => item.observedAt.slice(0, 10))),
  ).sort();
  const allowed = new Set(distinctDays.slice(0, upToDay));
  const filtered = observations.filter((item) =>
    allowed.has(item.observedAt.slice(0, 10)),
  );
  return buildBundle(crewId, {
    streamId,
    observations: filtered,
    now:
      now ??
      new Date(
        `${distinctDays[Math.max(0, Math.min(upToDay, distinctDays.length) - 1)]}T23:59:59.000Z`,
      ),
    withCaseLinks: false,
  });
}

function latestObservationAt(bundle: AssessmentBundle): string | null {
  const dates = bundle.domains
    .flatMap((domain) => domain.metrics.map((metric) => metric.observedAt))
    .filter((value): value is string => Boolean(value));
  if (dates.length === 0) return null;
  return dates.sort()[dates.length - 1];
}

export async function listCrewItems(): Promise<CrewListItem[]> {
  const crew = await listCrew(true);
  const state = await getState();
  const mission = await getAppliedMission(state);
  const items: CrewListItem[] = [];
  for (const member of crew) {
    const stream = await resolveStream(member.id, state);
    const observations = stream
      ? await listObservations(member.id, stream.id)
      : await listObservations(member.id, null);
    const bundle = buildAssessment({
      crew: member,
      observations,
      missionLogs: await listMissionLogs(member.id, stream?.id ?? null),
      mission,
      stream,
      ruleSetVersion: RULE_SET_VERSION,
    });
    const cases = await listCases({ crewId: member.id });
    items.push({
      profile: member,
      category: bundle.overallCategory,
      headline:
        bundle.nextStep?.title ??
        bundle.domains[0]?.headline ??
        "No demonstration flag is present.",
      openCaseCount: cases.filter((item) => item.status !== "archived").length,
      latestObservationAt: latestObservationAt(bundle),
      completeness: {
        available: bundle.completeness.available,
        total: bundle.completeness.total,
      },
      dataGaps: bundle.dataGaps.slice(0, 2),
      streamLabel: stream?.label ?? null,
    });
  }
  return items.sort(
    (left, right) =>
      CATEGORY_META[left.category].order -
        CATEGORY_META[right.category].order ||
      left.profile.displayName.localeCompare(right.profile.displayName),
  );
}

export async function buildCrewTable(): Promise<CrewWideRow[]> {
  const crew = await listCrew(true);
  const state = await getState();
  const mission = await getAppliedMission(state);
  const rows: CrewWideRow[] = [];
  for (const member of crew) {
    if (member.archived) continue;
    const stream = await resolveStream(member.id, state);
    const observations = stream
      ? await listObservations(member.id, stream.id)
      : await listObservations(member.id, null);
    const bundle = buildAssessment({
      crew: member,
      observations,
      missionLogs: await listMissionLogs(member.id, stream?.id ?? null),
      mission,
      stream,
      ruleSetVersion: RULE_SET_VERSION,
    });
    const cases = await listCases({ crewId: member.id });
    const flagged = bundle.domains.filter(
      (domain) =>
        domain.category === "priority" || domain.category === "review",
    );
    rows.push({
      hazardGaps: bundle.spaceContext.coverage
        .filter((h) => h.status !== "partial")
        .map((h) => `${h.label}: ${h.status.replace(/_/g, " ")}`),
      workflowChecks: bundle.spaceContext.workflowChecks.map((c) => c.title),
      crewId: member.id,
      crewName: member.displayName,
      callSign: member.callSign,
      category: bundle.overallCategory,
      headline: bundle.nextStep?.title ?? bundle.domains[0]?.headline ?? "",
      concerns: flagged.map((domain) => domain.label),
      reasons: flagged.map((domain) => domain.headline),
      dataGaps: bundle.dataGaps.slice(0, 4),
      nextAction:
        bundle.nextStep?.check?.prompt ??
        bundle.nextStep?.title ??
        "Continue routine monitoring",
      openCaseCount: cases.filter((item) => item.status !== "archived").length,
      completeness: {
        available: bundle.completeness.available,
        total: bundle.completeness.total,
      },
      domainCategories: bundle.domains.map((domain) => ({
        domain: domain.domain,
        label: domain.label,
        category: domain.category,
      })),
    });
  }
  return rows.sort(
    (left, right) =>
      CATEGORY_META[left.category].order -
        CATEGORY_META[right.category].order ||
      left.crewName.localeCompare(right.crewName),
  );
}

/* ------------------------------------------------------------------ cases */

function snapshotJson(domain: DomainAssessment): string {
  return JSON.stringify(domain);
}

export async function syncCrewCases(
  crewId: string,
  bundle: AssessmentBundle,
): Promise<CaseRecord[]> {
  const streamId = bundle.stream?.id ?? null;
  const touched: CaseRecord[] = [];

  for (const domain of bundle.domains) {
    const existing = await findOpenCase(crewId, domain.domain, streamId);
    const flags =
      domain.category === "priority" || domain.category === "review";

    if (flags && !existing) {
      const caseId = await insertCase({
        crewId,
        domain: domain.domain,
        title: `${DOMAINS[domain.domain].label} — ${bundle.crew.displayName}`,
        currentCategory: domain.category,
        streamId,
        snapshotJson: snapshotJson(domain),
        ruleSetVersion: bundle.ruleSetVersion,
      });
      await addCaseEvent({
        caseId,
        kind: "opened",
        title: `Case opened: ${CATEGORY_META[domain.category].label}`,
        body: `${domain.headline} Evidence snapshot captured at ${bundle.assessedAt} with rule set ${bundle.ruleSetVersion}.`,
        dedupeKey: `open:${caseId}`,
        data: {
          category: domain.category,
          domain: domain.domain,
          ruleIds: domain.ruleIds,
        },
        occurredAt: bundle.assessedAt,
      });
      const created = await findOpenCase(crewId, domain.domain, streamId);
      if (created) touched.push(created);
      continue;
    }

    if (!existing) continue;

    if (flags) {
      if (
        existing.currentCategory !== domain.category ||
        existing.status !== "open"
      ) {
        const from = existing.currentCategory;
        await updateCase(existing.id, {
          currentCategory: domain.category,
          status: "open",
          snapshotJson: snapshotJson(domain),
        });
        await addCaseEvent({
          caseId: existing.id,
          kind: "category_change",
          title: `Category changed: ${CATEGORY_META[from].label} → ${CATEGORY_META[domain.category].label}`,
          body: `${domain.headline} Rule set ${bundle.ruleSetVersion}, assessed ${bundle.assessedAt}.`,
          dedupeKey: `cat:${existing.id}:${from}:${domain.category}`,
          occurredAt: bundle.assessedAt,
          data: { from, to: domain.category, snapshot: domain },
        });
      } else {
        await updateCase(existing.id, { snapshotJson: snapshotJson(domain) });
      }
    } else if (
      domain.category === "no_flags" &&
      existing.currentCategory !== "no_flags"
    ) {
      await updateCase(existing.id, {
        currentCategory: "no_flags",
        status: "monitoring",
        snapshotJson: snapshotJson(domain),
      });
      await addCaseEvent({
        caseId: existing.id,
        kind: "category_change",
        title: "Screening change: No Demo Flags",
        body: `${domain.headline} This is a screening change recorded with rule set ${bundle.ruleSetVersion}; earlier evidence is retained and clinical recovery is not asserted.`,
        dedupeKey: `cat:${existing.id}:${existing.currentCategory}:no_flags`,
        occurredAt: bundle.assessedAt,
        data: {
          from: existing.currentCategory,
          to: "no_flags",
          snapshot: domain,
        },
      });
    }
    const refreshed = await findOpenCase(crewId, domain.domain, streamId);
    if (refreshed) touched.push(refreshed);
  }

  return touched;
}

export async function syncAllCrewCases(): Promise<void> {
  const crew = await listCrew(false);
  for (const member of crew) {
    const bundle = await buildBundle(member.id, { withCaseLinks: false });
    await syncCrewCases(member.id, bundle);
  }
}

/* ---------------------------------------------------------- guided checks */

export async function resolveCheck(params: {
  crewId: string;
  domain: DomainKey;
  metric?: string | null;
}): Promise<GuidedCheck> {
  const bundle = await buildBundle(params.crewId);
  const domain = bundle.domains.find((item) => item.domain === params.domain);
  if (!domain) throw new Error(`Unknown domain ${params.domain}`);
  const metric = (params.metric ??
    domain.nextCheck?.metric ??
    DOMAINS[params.domain].metrics[0]) as GuidedCheck["metric"];
  const open = await listChecks({ crewId: params.crewId, status: "open" });
  const existing = open.find(
    (check) =>
      check.metric === metric &&
      check.domain === params.domain &&
      check.streamId === (bundle.stream?.id ?? null),
  );
  if (existing) return existing;

  const recommendation =
    domain.nextCheck && domain.nextCheck.metric === metric
      ? domain.nextCheck
      : {
          prompt: `Record ${METRICS[metric].label.toLowerCase()}`,
          reason: `The ${domain.label.toLowerCase()} screen has a data or follow-up need for this measurement.`,
          ruleIds: domain.ruleIds,
          urgent: domain.category === "priority",
        };

  return createCheck({
    crewId: params.crewId,
    caseId: bundle.nextStep?.openCaseId ?? null,
    domain: params.domain,
    metric,
    prompt: recommendation.prompt,
    reason: recommendation.reason,
    ruleIds: recommendation.ruleIds,
    streamId: bundle.stream?.id ?? null,
    urgency: recommendation.urgent ? "priority" : "routine",
  });
}

export function categoryLabel(category: Category): string {
  return CATEGORY_META[category].label;
}

export function domainLabel(domain: DomainKey): string {
  return DOMAINS[domain].label;
}

export const ALL_DOMAINS = DOMAIN_KEYS;

export type BundleSummary = {
  crew: CrewProfile;
  mission: MissionSettings | null;
  bundle: AssessmentBundle;
};
