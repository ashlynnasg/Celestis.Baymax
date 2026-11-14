import { useState } from "react";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { SourceCard } from "@/components/science";
import {
  AppTextInput,
  COLORS,
  GhostButton,
  Notice,
  Panel,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { REFERENCE_LIBRARY, type ReferenceKey } from "@/shared/constants";

export default function EvidenceScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const keys = (Object.keys(REFERENCE_LIBRARY) as ReferenceKey[]).filter(
    (key) => {
      const s = REFERENCE_LIBRARY[key];
      return `${s.title} ${s.supports} ${s.agency}`
        .toLowerCase()
        .includes(search.toLowerCase());
    },
  );
  return (
    <ScreenContainer>
      <ScreenScroll>
        <GhostButton
          label="Back"
          icon="arrow-back"
          onPress={() => router.back()}
        />
        <Text style={{ color: COLORS.text, fontSize: 24, fontWeight: "700" }}>
          Scientific evidence library
        </Text>
        <Notice title="References and records serve different purposes">
          These reviewed summaries explain monitoring relevance. They are not
          imported astronaut records, validated prediction models or approved
          clinical protocols. All eight screening domains still use explicit
          demonstration assumptions.
        </Notice>
        <Panel style={{ gap: 10 }}>
          <SectionTitle title="What is connected" />
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.body,
              lineHeight: 22,
            }}
          >
            An assessment shows the recorded evidence, relevant spaceflight
            topic, exact demo rule and uncertainty. References remain readable
            offline; agency links need internet. Source checks below are project
            checks, not clinical review.
          </Text>
          <GhostButton
            label="Open measurement import"
            icon="upload-file"
            onPress={() => router.push("/import")}
          />
          <GhostButton
            label="Open hazard coverage"
            icon="travel-explore"
            onPress={() => router.push("/mission-context")}
          />
        </Panel>
        <AppTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search agency, topic or title"
        />
        <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>
          {keys.length} matching sources / local assumptions
        </Text>
        <View style={{ gap: 12 }}>
          {keys.map((key) => (
            <SourceCard key={key} sourceKey={key} />
          ))}
        </View>
        {!keys.length ? (
          <Notice>
            No matching sources. Try “sleep”, “NASA” or “radiation”.
          </Notice>
        ) : null}
      </ScreenScroll>
    </ScreenContainer>
  );
}
