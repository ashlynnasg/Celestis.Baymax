import { useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { ExternalLink } from "./external-link";
import {
  COLORS,
  Chip,
  GhostButton,
  Notice,
  Panel,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { REFERENCE_LIBRARY, type ReferenceKey } from "@/shared/constants";
import {
  HAZARDS,
  type ScienceContext,
  type SpaceContextReport,
} from "@/shared/mission-context";

export function SourceCard({ sourceKey }: { sourceKey: ReferenceKey }) {
  const s = REFERENCE_LIBRARY[sourceKey];
  return (
    <Panel soft style={{ gap: 7 }}>
      <Text style={{ color: COLORS.roseSoft, fontSize: UI.tiny }}>
        {s.agency} · {s.kind.replace(/_/g, " ")}
      </Text>
      <Text
        style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.body }}
      >
        {s.title}
      </Text>
      <Text
        style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}
      >
        {s.supports}
      </Text>
      <Text
        style={{ color: COLORS.review, fontSize: UI.small, lineHeight: 20 }}
      >
        Evidence boundary: {s.limitation}
      </Text>
      <Text
        style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}
      >
        Section: {s.section} · source checked {s.reviewedAt}. Project source
        check; no clinical approval. This source does not validate app
        thresholds.
      </Text>
      {s.url ? (
        <ExternalLink
          href={s.url}
          accessibilityLabel={`Open source: ${s.title}`}
          style={{
            color: COLORS.primarySoft,
            paddingVertical: 8,
            fontSize: UI.small,
          }}
        >
          Open agency source ↗ (internet required)
        </ExternalLink>
      ) : null}
    </Panel>
  );
}

export function ScientificContextCard({ value }: { value: ScienceContext }) {
  const router = useRouter();
  return (
    <Panel style={{ gap: 8 }}>
      <SectionTitle
        title="Why this matters in space"
        hint="Observation → relevance → demonstration rule → limits"
      />
      <Text
        style={{ color: COLORS.text, fontSize: UI.body, fontWeight: "700" }}
      >
        {value.riskTopic}
      </Text>
      <Text style={{ color: COLORS.roseSoft, fontSize: UI.small }}>
        {value.hazards
          .map((key) => HAZARDS.find((h) => h.key === key)?.label)
          .join(" · ")}
      </Text>
      <Text
        style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}
      >
        {value.boundary}
      </Text>
      <Notice title="Threshold basis">{value.thresholdBasis}</Notice>
      <GhostButton
        label="Inspect scientific references"
        icon="menu-book"
        onPress={() => router.push("/evidence")}
      />
    </Panel>
  );
}

export function HazardPanel({ report }: { report: SpaceContextReport }) {
  const [selected, setSelected] = useState(report.coverage[0]?.key);
  const router = useRouter();
  const hazard =
    report.coverage.find((h) => h.key === selected) ?? report.coverage[0];
  const label = {
    partial: "Partial records",
    stale: "Older records",
    not_assessed: "Not assessed",
  };
  return (
    <Panel style={{ gap: 10 }}>
      <SectionTitle
        title="Mission hazards & monitoring coverage"
        hint="Availability of evidence, separate from medical review priority."
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {report.coverage.map((h) => (
          <Chip
            key={h.key}
            label={`${h.label} · ${label[h.status]}`}
            active={h.key === selected}
            tone={COLORS.primarySoft}
            onPress={() => setSelected(h.key)}
          />
        ))}
      </View>
      {hazard ? (
        <View style={{ gap: 8 }}>
          <Text
            style={{ color: COLORS.text, fontWeight: "700", fontSize: UI.body }}
          >
            {hazard.label}: {label[hazard.status]}
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.small,
              lineHeight: 20,
            }}
          >
            {hazard.summary}
          </Text>
          {hazard.gaps.map((g) => (
            <Text
              key={g}
              style={{
                color: COLORS.moreData,
                fontSize: UI.small,
                lineHeight: 20,
              }}
            >
              • {g}
            </Text>
          ))}
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {hazard.domainKeys.map((d) => (
              <GhostButton
                key={d}
                label={
                  d === "boneHealth"
                    ? "Bone monitoring"
                    : d === "visionChange"
                      ? "Vision reports"
                      : d.replace(/([A-Z])/g, " $1")
                }
                onPress={() => router.push(`/assessment/${d}`)}
              />
            ))}
          </View>
          <GhostButton
            label={
              hazard.key === "distance"
                ? "Open delayed handover"
                : "Record context or exposure"
            }
            icon={hazard.key === "distance" ? "settings-input-antenna" : "add"}
            onPress={() =>
              hazard.key === "distance"
                ? router.push("/link")
                : router.push(
                    `/mission-context?kind=${hazard.key === "radiation" ? "radiation" : hazard.key === "environment" ? "cabin" : "context"}`,
                  )
            }
          />
        </View>
      ) : null}
      <GhostButton
        label="NASA / CSA evidence library"
        icon="menu-book"
        onPress={() => router.push("/evidence")}
      />
      <Text
        style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}
      >
        {report.limitation}
      </Text>
    </Panel>
  );
}
