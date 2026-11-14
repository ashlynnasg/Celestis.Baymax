import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Text, View } from "react-native";

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
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { trpc } from "@/lib/trpc";

function Bullets({ items, tone }: { items: string[]; tone?: string }) {
  return (
    <View style={{ gap: 5 }}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={{ flexDirection: "row", gap: 6 }}>
          <Text style={{ color: tone ?? COLORS.roseSoft, fontSize: UI.small }}>•</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, flex: 1, lineHeight: 20 }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function CareScreen() {
  const { domain } = useLocalSearchParams<{ domain: string }>();
  const router = useRouter();
  const { crewId } = useApp();
  const query = trpc.assessment.care.useQuery({ crewId: crewId ?? "", domain: domain ?? "" }, { enabled: Boolean(crewId && domain) });

  if (!crewId || query.isLoading) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          {query.isError ? <ErrorState message={query.error.message} /> : <LoadingState label="Building personalised support" />}
        </ScreenScroll>
      </ScreenContainer>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <ErrorState message={query.error?.message ?? "Support content is unavailable."} onRetry={() => query.refetch()} />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  const plan = query.data;

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>

        <Panel style={{ gap: 8 }}>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, letterSpacing: 1.2, fontWeight: "700" }}>
            PREVENTION & TREATMENT SUPPORT
          </Text>
          <Text style={{ color: COLORS.text, fontSize: 21, fontWeight: "700" }}>{plan.label}</Text>
          <CategoryPill category={plan.category} />
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}>{plan.categoryMeaning}</Text>
        </Panel>

        <Notice tone="danger" title="Emergency first">
          {plan.emergencyNote}
        </Notice>

        <Panel>
          <SectionTitle title="What the finding may mean" />
          <Bullets items={plan.mayMean} />
          <View style={{ height: 10 }} />
          <SectionTitle title="What it cannot tell you" />
          <Bullets items={plan.cannotConclude} tone={COLORS.moreData} />
        </Panel>

        <Panel>
          <SectionTitle title="Preventive support" hint="Each suggestion carries the reason it was selected." />
          <View style={{ gap: 12 }}>
            {plan.prevention.map((item) => (
              <View key={item.title} style={{ gap: 3 }}>
                <Text style={{ color: COLORS.roseSoft, fontSize: 11, letterSpacing: 1, fontWeight: "700" }}>
                  {item.area.toUpperCase()}
                </Text>
                <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>{item.detail}</Text>
                <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>Why: {item.reason}</Text>
              </View>
            ))}
          </View>
        </Panel>

        <Panel>
          <SectionTitle title="Educational first-aid support" hint="General principles only; the app never supplies doses." />
          <View style={{ gap: 10 }}>
            {plan.firstAid.map((item) => (
              <View key={item.title} style={{ gap: 2 }}>
                <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>{item.detail}</Text>
              </View>
            ))}
          </View>
        </Panel>

        <Panel>
          <SectionTitle title="When to seek medical review" />
          <Bullets items={plan.seekReview} tone={COLORS.review} />
          <View style={{ height: 10 }} />
          <SectionTitle title="Follow-up observations" />
          <Bullets items={plan.followUp} />
          <View style={{ height: 10 }} />
          <SectionTitle title="Recovery monitoring" />
          <Bullets items={plan.recoveryMonitoring} tone={COLORS.noFlags} />
        </Panel>

        <Panel>
          <SectionTitle title="Protocol integration" hint="Structure prepared for future approved protocols." />
          {plan.protocols.map((protocol) => (
            <View key={protocol.title} style={{ gap: 2, marginBottom: 8 }}>
              <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "600" }}>{protocol.title}</Text>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
                Source: {protocol.source} · version {protocol.version} · reviewer {protocol.reviewer}
              </Text>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                Approval: {protocol.approvalStatus} · review date {protocol.reviewDate}
              </Text>
            </View>
          ))}
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
            No protocol approval was supplied, so the record stays unapproved. An unapproved protocol can never drive a
            clearance decision.
          </Text>
        </Panel>

        <Panel>
          <SectionTitle title="Sources and evidence limitations" />
          {plan.references.map((reference) => (
            <View key={reference.label} style={{ marginBottom: 8, gap: 2 }}>
              <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "600" }}>{reference.label}</Text>
              <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>{reference.note}</Text>
              {reference.url ? (
                <Text
                  style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}
                  onPress={() => Linking.openURL(reference.url as string).catch(() => undefined)}
                >
                  {reference.url}
                </Text>
              ) : null}
            </View>
          ))}
          <Bullets items={plan.limitations} tone={COLORS.moreData} />
        </Panel>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <GhostButton label="Back to evidence" icon="arrow-back" onPress={() => router.push(`/assessment/${domain}`)} />
          <GhostButton label="Start a check" icon="checklist" onPress={() => router.push(`/check/new?domain=${domain}`)} />
        </View>
      </ScreenScroll>
    </ScreenContainer>
  );
}
