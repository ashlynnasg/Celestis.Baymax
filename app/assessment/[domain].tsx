import { ScientificContextCard, SourceCard } from "@/components/science";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import {
  EvidenceList,
  FreshnessLine,
  GapList,
  StreamBanner,
} from "@/components/app-blocks";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  COLORS,
  CategoryPill,
  ErrorState,
  GhostButton,
  LoadingState,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { CATEGORY_META, REFERENCE_LIBRARY } from "@/shared/constants";
import { trpc } from "@/lib/trpc";

export default function AssessmentDomainScreen() {
  const { domain } = useLocalSearchParams<{ domain: string }>();
  const router = useRouter();
  const { crewId } = useApp();

  const query = trpc.assessment.domain.useQuery(
    { crewId: crewId ?? "", domain: domain ?? "" },
    { enabled: Boolean(crewId && domain) },
  );

  if (!crewId) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState message="Select a crew member from the Overview tab first." />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  if (query.isLoading) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <LoadingState />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  if (query.isError || !query.data) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState
            message={query.error?.message ?? "Screening domain not found."}
            onRetry={() => query.refetch()}
          />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  const { bundle, domain: assessment } = query.data;
  const meta = CATEGORY_META[assessment.category];

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <GhostButton
            label="Back"
            icon="arrow-back"
            onPress={() => router.back()}
          />
          <Text
            style={{ color: COLORS.textFaint, fontSize: UI.tiny, flex: 1 }}
            numberOfLines={1}
          >
            {bundle.crew.displayName} · {bundle.crew.callSign}
          </Text>
        </View>

        <Panel style={{ gap: 10, borderColor: `${meta.color}55` }}>
          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: UI.tiny,
              letterSpacing: 1.2,
              fontWeight: "700",
            }}
          >
            EXPLAINABLE SCREENING
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                color: COLORS.text,
                fontSize: 21,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {assessment.label}
            </Text>
          </View>
          <CategoryPill category={assessment.category} />
          <Text
            style={{
              color: COLORS.text,
              fontSize: UI.body,
              fontWeight: "600",
              lineHeight: 22,
            }}
          >
            {assessment.headline}
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.small,
              lineHeight: 20,
            }}
          >
            {assessment.explanation}
          </Text>
          <Text
            style={{ color: meta.color, fontSize: UI.small, lineHeight: 19 }}
          >
            {meta.instruction}
          </Text>
          <FreshnessLine domain={assessment} />
        </Panel>

        <StreamBanner bundle={bundle} />
        <ScientificContextCard value={assessment.scientificContext} />
        {bundle.spaceContext.contextFacts.length ? (
          <Notice title="Latest mission context (not a diagnosis)">
            {bundle.spaceContext.contextFacts.join("; ")}
          </Notice>
        ) : null}

        {assessment.facts.length > 0 ? (
          <Panel>
            <SectionTitle
              title="Supporting facts"
              hint="Values, dates, units and context for the rules that fired."
            />
            <View style={{ gap: 6 }}>
              {assessment.facts.map((fact, index) => (
                <Text
                  key={`${fact}-${index}`}
                  style={{
                    color: COLORS.textMuted,
                    fontSize: UI.small,
                    lineHeight: 20,
                  }}
                >
                  • {fact}
                </Text>
              ))}
            </View>
          </Panel>
        ) : null}

        <Panel>
          <SectionTitle
            title="Evidence used"
            hint={`${assessment.completeness.available} of ${assessment.completeness.total} relevant fields available`}
          />
          <EvidenceList evidence={assessment.evidence} />
        </Panel>

        <Panel>
          <SectionTitle title="Uncertainty and limits" />
          <GapList gaps={[...assessment.dataGaps, ...assessment.uncertainty]} />
        </Panel>

        <Panel>
          <SectionTitle
            title="Rules and assumptions"
            hint="The exact demonstration logic behind this category."
          />
          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: UI.tiny,
              marginBottom: 6,
            }}
          >
            Rule set {bundle.ruleSetVersion} · evaluated{" "}
            {new Date(bundle.assessedAt).toISOString()}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {assessment.ruleIds.map((rule) => (
              <Text
                key={rule}
                style={{
                  color: COLORS.roseSoft,
                  fontSize: 11,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                {rule}
              </Text>
            ))}
          </View>
          {assessment.assumptions.map((assumption, index) => (
            <Text
              key={`${assumption}-${index}`}
              style={{
                color: COLORS.textMuted,
                fontSize: UI.tiny,
                lineHeight: 17,
                marginBottom: 4,
              }}
            >
              • {assumption}
            </Text>
          ))}
        </Panel>

        <Panel>
          <SectionTitle
            title="Preventive suggestions"
            hint="Personalised to this concern, with the reason for each."
          />
          <View style={{ gap: 10 }}>
            {assessment.preventive.map((item) => (
              <View key={item.title} style={{ gap: 2 }}>
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: UI.small,
                    fontWeight: "700",
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  style={{
                    color: COLORS.textMuted,
                    fontSize: UI.small,
                    lineHeight: 19,
                  }}
                >
                  {item.detail}
                </Text>
                <Text
                  style={{
                    color: COLORS.textFaint,
                    fontSize: UI.tiny,
                    lineHeight: 16,
                  }}
                >
                  Why: {item.reason}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 10 }}>
            <GhostButton
              label="Open prevention & treatment support"
              icon="medical-services"
              onPress={() => router.push(`/care/${assessment.domain}`)}
            />
          </View>
        </Panel>

        <Panel style={{ borderColor: `${COLORS.primarySoft}55` }}>
          <SectionTitle
            title="Recommended next check"
            hint="One useful action at a time."
          />
          <Text
            style={{ color: COLORS.text, fontSize: UI.body, fontWeight: "600" }}
          >
            {assessment.nextCheck?.prompt ?? "Continue routine monitoring"}
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.small,
              marginTop: 4,
              lineHeight: 19,
            }}
          >
            {assessment.nextCheck?.reason ??
              "No additional measurement is recommended by the demonstration rules right now."}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <PrimaryButton
              label={
                assessment.nextCheck?.urgent
                  ? "Arrange priority review"
                  : "Start guided check"
              }
              icon="checklist"
              onPress={() =>
                router.push(
                  `/check/new?domain=${assessment.domain}${assessment.nextCheck ? `&metric=${assessment.nextCheck.metric}` : ""}`,
                )
              }
            />
            {assessment.nextCheck?.urgent ? (
              <GhostButton
                label="Escalation guidance"
                icon="warning"
                onPress={() => router.push(`/care/${assessment.domain}`)}
              />
            ) : null}
          </View>
        </Panel>

        <Panel>
          <SectionTitle
            title="References"
            hint="Sources named by the rule set."
          />
          {assessment.references.map((key) => (
            <View key={key} style={{ marginBottom: 10 }}>
              <SourceCard sourceKey={key} />
            </View>
          ))}
        </Panel>

        <Notice tone="warning" title="What this category is not">
          {meta.label} is an output of illustrative demonstration rules. It is
          not a diagnosis, not a probability, and never a clearance decision.
        </Notice>
      </ScreenScroll>
    </ScreenContainer>
  );
}
