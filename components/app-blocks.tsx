import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";

import { COLORS, CategoryPill, Chip, Panel, UI } from "@/lib/ui";
import {
  CATEGORY_META,
  DOMAINS,
  type Category,
  type DomainKey,
} from "@/shared/constants";
import { formatAge, formatDateTime } from "@/shared/format";
import type { AssessmentBundle, DomainAssessment, EvidenceItem } from "@/shared/domain";

export function StreamBanner({ bundle }: { bundle: AssessmentBundle }) {
  if (!bundle.stream) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: COLORS.panelSoft,
          borderRadius: UI.radiusSm,
          paddingHorizontal: 11,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <MaterialIcons name="dataset" size={14} color={COLORS.textFaint} />
        <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, flex: 1 }}>
          Baseline stream · seeded demonstration data (fictional)
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: `${COLORS.review}18`,
        borderRadius: UI.radiusSm,
        paddingHorizontal: 11,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: `${COLORS.review}66`,
      }}
    >
      <MaterialIcons name="science" size={14} color={COLORS.review} />
      <Text style={{ color: COLORS.review, fontSize: UI.tiny, flex: 1, fontWeight: "600" }}>
        Simulated stream applied: {bundle.stream.label}. Values here are generated, not measured.
      </Text>
    </View>
  );
}

export function CrewSwitcher({
  crewList,
  selectedId,
  onSelect,
}: {
  crewList: { id: string; displayName: string; callSign: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      accessibilityLabel="Crew switcher. Choose the astronaut every screen follows."
    >
      {crewList.map((member) => (
        <Chip
          key={member.id}
          label={`${member.displayName.split(" ")[0]} · ${member.callSign}`}
          active={member.id === selectedId}
          onPress={() => onSelect(member.id)}
        />
      ))}
    </ScrollView>
  );
}

export function NextStepCard({
  bundle,
  onStartCheck,
  onOpenCase,
}: {
  bundle: AssessmentBundle;
  onStartCheck: () => void;
  onOpenCase?: (caseId: string) => void;
}) {
  const step = bundle.nextStep;
  const meta = CATEGORY_META[bundle.overallCategory];
  return (
    <Panel style={{ borderColor: `${meta.color}66`, backgroundColor: COLORS.panelRaised }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny, letterSpacing: 1.4, fontWeight: "700" }}>YOUR NEXT STEP</Text>
        <CategoryPill category={bundle.overallCategory} compact />
      </View>
      <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
        {step?.title ?? "Keep routine monitoring"}
      </Text>
      <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}>
        {step?.detail ?? "No demonstration flag is present. Formal medical clearance stays with authorised personnel."}
      </Text>
      <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, marginTop: 10 }}>
        {bundle.crew.displayName} · {DOMAINS[step?.domain ?? "cardiovascular"].label} · assessed {formatDateTime(bundle.assessedAt)}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <Pressable
          onPress={onStartCheck}
          accessibilityRole="button"
          style={({ pressed }) => ({
            backgroundColor: COLORS.primary,
            borderRadius: UI.radiusSm,
            paddingVertical: 11,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <MaterialIcons name="checklist" size={16} color={COLORS.text} />
          <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.small }}>Start useful check</Text>
        </Pressable>
        {step?.openCaseId && onOpenCase ? (
          <Pressable
            onPress={() => onOpenCase(step.openCaseId as string)}
            accessibilityRole="button"
            accessibilityLabel="Open the continuing case timeline"
            style={{ paddingVertical: 11, paddingHorizontal: 6 }}
          >
            <Text style={{ color: COLORS.textMuted, fontSize: UI.small, fontWeight: "600" }}>
              Open case timeline
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Panel>
  );
}

export function DomainRow({
  domain,
  onPress,
  openCaseId,
}: {
  domain: DomainAssessment;
  onPress: () => void;
  openCaseId?: string | null;
}) {
  const meta = CATEGORY_META[domain.category];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${domain.label}: ${meta.label}. ${domain.headline}`}
      style={({ pressed }) => ({
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: UI.radiusSm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: pressed ? COLORS.panelRaised : COLORS.panelSoft,
        gap: 6,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color }} />
        <Text style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.body, flex: 1 }}>{domain.label}</Text>
        <Text style={{ color: meta.color, fontSize: UI.tiny, fontWeight: "700" }}>{meta.short}</Text>
        <MaterialIcons name="chevron-right" size={16} color={COLORS.textFaint} />
      </View>
      <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }} numberOfLines={3}>
        {domain.headline}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
          data {domain.completeness.available}/{domain.completeness.total} fields
        </Text>
        <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>·</Text>
        <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>{domain.freshness.label}</Text>
        {openCaseId ? (
          <>
            <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>·</Text>
            <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}>case open</Text>
          </>
        ) : null}
      </View>
    </Pressable>
  );
}

export function EvidenceList({ evidence }: { evidence: EvidenceItem[] }) {
  return (
    <View style={{ gap: 8 }}>
      {evidence.map((item, index) => (
        <View
          key={`${item.label}-${index}`}
          style={{
            borderLeftWidth: 2,
            borderLeftColor: COLORS.borderStrong,
            paddingLeft: 10,
            paddingVertical: 2,
            gap: 2,
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: UI.small, fontWeight: "600" }}>{item.label}</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>{item.value}</Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
            {item.observedAt ? `${formatDateTime(item.observedAt)} · ` : item.kind === "history" ? "Medical history · " : ""}
            {item.context ? `${item.context.replace("_", " ")} · ` : ""}
            {item.sourceLabel ?? "derived from the selected record"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function GapList({ gaps, title = "Data gaps" }: { gaps: string[]; title?: string }) {
  if (gaps.length === 0) {
    return <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>No gaps in the current field set.</Text>;
  }
  return (
    <View style={{ gap: 5 }}>
      <Text style={{ color: COLORS.textMuted, fontSize: UI.tiny, fontWeight: "700", letterSpacing: 0.6 }}>{title.toUpperCase()}</Text>
      {gaps.map((gap) => (
        <View key={gap} style={{ flexDirection: "row", gap: 6 }}>
          <Text style={{ color: COLORS.moreData, fontSize: UI.small }}>•</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, flex: 1, lineHeight: 19 }}>{gap}</Text>
        </View>
      ))}
    </View>
  );
}

export function FreshnessLine({ domain }: { domain: DomainAssessment }) {
  return (
    <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
      Newest evidence {domain.freshness.newest ? `${formatDateTime(domain.freshness.newest)} (${formatAge(
        Math.max(0, (Date.now() - new Date(domain.freshness.newest).getTime()) / 3600000),
      )})` : "none recorded"} · freshness is a demonstration engineering setting, tracked separately from the concern.
    </Text>
  );
}

export function CategoryLegend() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {(["priority", "review", "more_data", "no_flags"] as Category[]).map((category) => (
        <View key={category} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: CATEGORY_META[category].color }} />
          <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>{CATEGORY_META[category].label}</Text>
        </View>
      ))}
    </View>
  );
}

const REGION_COLOR: Record<DomainKey, string> = {
  cardiovascular: COLORS.priority,
  boneHealth: COLORS.review,
  muscleConditioning: COLORS.review,
  sleepRestriction: COLORS.moreData,
  fatigue: COLORS.moreData,
  visionChange: COLORS.priority,
  stressWellbeing: COLORS.moreData,
  respiratory: COLORS.priority,
};

export function BodyMap({
  domains,
  onSelect,
  selectedDomain,
}: {
  domains: DomainAssessment[];
  onSelect: (domain: DomainKey) => void;
  selectedDomain?: DomainKey | null;
}) {
  const categoryFor = (domain: DomainKey): Category =>
    domains.find((item) => item.domain === domain)?.category ?? "more_data";
  const fill = (domain: DomainKey) => `${CATEGORY_META[categoryFor(domain)].color}33`;
  const stroke = (domain: DomainKey) => CATEGORY_META[categoryFor(domain)].color;

  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      <Svg width={190} height={230} pointerEvents="none">
        <Circle cx={95} cy={30} r={22} fill={fill("sleepRestriction")} stroke={stroke("sleepRestriction")} strokeWidth={1.5} />
        <Circle cx={95} cy={30} r={6} fill={fill("visionChange")} stroke={stroke("visionChange")} strokeWidth={1.5} />
        <Rect x={66} y={56} width={58} height={80} rx={18} fill={fill("cardiovascular")} stroke={stroke("cardiovascular")} strokeWidth={1.5} />
        <Ellipse cx={95} cy={112} rx={20} ry={22} fill={fill("stressWellbeing")} stroke={stroke("stressWellbeing")} strokeWidth={1.2} />
        <Path d="M66 64 L44 106 L52 112 L70 80 Z" fill={fill("muscleConditioning")} stroke={stroke("muscleConditioning")} strokeWidth={1.5} />
        <Path d="M124 64 L146 106 L138 112 L120 80 Z" fill={fill("muscleConditioning")} stroke={stroke("muscleConditioning")} strokeWidth={1.5} />
        <Circle cx={74} cy={92} r={10} fill={fill("respiratory")} stroke={stroke("respiratory")} strokeWidth={1.2} />
        <Circle cx={116} cy={92} r={10} fill={fill("respiratory")} stroke={stroke("respiratory")} strokeWidth={1.2} />
        <Path d="M78 136 L74 208 L88 208 L94 150 L96 150 L102 208 L116 208 L112 136 Z" fill={fill("boneHealth")} stroke={stroke("boneHealth")} strokeWidth={1.5} />
        <Circle cx={60} cy={198} r={3} fill={COLORS.textFaint} />
        <Circle cx={130} cy={198} r={3} fill={COLORS.textFaint} />
      </Svg>
      <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny, textAlign: "center" }}>
        Navigation only — regions are never a diagnosis. Use the labelled buttons below.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {(Object.keys(DOMAINS) as DomainKey[]).map((domain) => (
          <Chip
            key={domain}
            label={DOMAINS[domain].shortLabel}
            tone={REGION_COLOR[domain]}
            active={selectedDomain === domain}
            onPress={() => onSelect(domain)}
          />
        ))}
      </View>
    </View>
  );
}
