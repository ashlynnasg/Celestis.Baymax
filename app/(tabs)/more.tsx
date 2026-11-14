import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  COLORS,
  Notice,
  Panel,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";

const LINKS: {
  title: string;
  detail: string;
  icon: string;
  route: string;
  tone?: string;
}[] = [
  {
    title: "Mission context & radiation",
    detail: "Hazard coverage, context check-ins, exposure and cabin records.",
    icon: "travel-explore",
    route: "/mission-context",
    tone: COLORS.primarySoft,
  },
  {
    title: "NASA / CSA evidence library",
    detail: "Trace each explanation to its source and evidence boundaries.",
    icon: "menu-book",
    route: "/evidence",
    tone: COLORS.rose,
  },
  {
    title: "Baymax health assistant",
    detail:
      "Local, offline explanations from the selected demonstration record.",
    icon: "chat-bubble-outline",
    route: "/assistant",
    tone: COLORS.rose,
  },
  {
    title: "Guided checks",
    detail: "One question at a time, with the reason it matters.",
    icon: "checklist",
    route: "/check/new",
    tone: COLORS.teal,
  },
  {
    title: "Case timelines",
    detail: "Dated evidence, category changes, checks and handovers.",
    icon: "folder-open",
    route: "/cases",
    tone: COLORS.coral,
  },
  {
    title: "Mission health simulator",
    detail: "Six scenarios, seven days, before/after evidence comparison.",
    icon: "science",
    route: "/simulator",
    tone: COLORS.amber,
  },
  {
    title: "Data integration",
    detail:
      "CSV/JSON import with mapping, validation and a downloadable report.",
    icon: "upload-file",
    route: "/import",
    tone: COLORS.sky,
  },
  {
    title: "Deep Space Link",
    detail:
      "Delayed handover states, simulated outage and fictional ground reply.",
    icon: "settings-input-antenna",
    route: "/link",
    tone: COLORS.teal,
  },
  {
    title: "Settings, rules and limitations",
    detail: "Rule set version, timezone, exports and the explicit demo reset.",
    icon: "settings",
    route: "/settings",
    tone: COLORS.primarySoft,
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { meta, appliedMissionName, activeStream, crewName } = useApp();

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>
            Workflow
          </Text>
          <Text
            style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 3 }}
          >
            {crewName ?? "No crew selected"} ·{" "}
            {appliedMissionName ?? "no applied mission"} ·{" "}
            {activeStream ? `stream: ${activeStream.label}` : "baseline stream"}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {LINKS.map((link) => (
            <Pressable
              key={link.route}
              onPress={() => router.push(link.route as never)}
              accessibilityRole="button"
              accessibilityLabel={link.title}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: pressed ? COLORS.panelRaised : COLORS.panel,
                borderWidth: 1,
                borderColor: `${link.tone ?? COLORS.primarySoft}55`,
                borderLeftColor: link.tone ?? COLORS.primarySoft,
                borderLeftWidth: 3,
                borderRadius: UI.radius,
                padding: 14,
              })}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${link.tone ?? COLORS.primarySoft}20`,
                }}
              >
                <MaterialIcons
                  name={link.icon as never}
                  size={18}
                  color={link.tone ?? COLORS.primarySoft}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: UI.body,
                    fontWeight: "700",
                  }}
                >
                  {link.title}
                </Text>
                <Text
                  style={{
                    color: COLORS.textFaint,
                    fontSize: UI.tiny,
                    lineHeight: 16,
                  }}
                >
                  {link.detail}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={18}
                color={COLORS.textFaint}
              />
            </Pressable>
          ))}
        </View>

        <Panel>
          <SectionTitle title="Scope of this build" />
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.small,
              lineHeight: 20,
            }}
          >
            Software only: no sensors, wearables or camera-based vital signs.
            Every observation is manual, imported or generated by a named
            simulator scenario. Profiles are fictional.
          </Text>
          <View style={{ height: 8 }} />
          <Text
            style={{
              color: COLORS.textFaint,
              fontSize: UI.tiny,
              lineHeight: 16,
            }}
          >
            Rule set {meta?.ruleSetVersion ?? "—"} · seed{" "}
            {meta?.seedVersion ?? "—"} · timezone {meta?.timezone ?? "UTC"}
          </Text>
        </Panel>

        <Notice tone="warning" title="Honest limitation">
          Celestial Baymax is a hackathon demonstration. It does not predict
          disease, demonstrate clinical benefit or certify flight readiness, and
          its local store is not encrypted merely because it has an owner
          account.
        </Notice>
      </ScreenScroll>
    </ScreenContainer>
  );
}
