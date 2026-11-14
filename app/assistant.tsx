import { ExternalLink } from "@/components/external-link";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import {
  AppTextInput,
  COLORS,
  Chip,
  EmptyState,
  GhostButton,
  LoadingState,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import type { AssistantAnswer, AssistantMessage } from "@/shared/domain";
import { trpc } from "@/lib/trpc";

function AnswerCard({
  answer,
  onNavigate,
}: {
  answer: AssistantAnswer;
  onNavigate: (route: string) => void;
}) {
  return (
    <Panel style={{ gap: 10 }}>
      <Text
        style={{
          color: COLORS.roseSoft,
          fontSize: 11,
          letterSpacing: 1.1,
          fontWeight: "700",
        }}
      >
        {answer.intentLabel.toUpperCase()}
      </Text>
      <Text style={{ color: COLORS.text, fontSize: UI.body, lineHeight: 21 }}>
        {answer.summary}
      </Text>

      {answer.facts.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text
            style={{ color: COLORS.textFaint, fontSize: 11, fontWeight: "700" }}
          >
            SUPPORTING FACTS
          </Text>
          {answer.facts.map((fact, index) => (
            <Text
              key={`${fact}-${index}`}
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 19,
              }}
            >
              • {fact}
            </Text>
          ))}
        </View>
      ) : null}

      {answer.gaps.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text
            style={{ color: COLORS.moreData, fontSize: 11, fontWeight: "700" }}
          >
            MISSING INFORMATION
          </Text>
          {answer.gaps.map((gap) => (
            <Text
              key={gap}
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 19,
              }}
            >
              – {gap}
            </Text>
          ))}
        </View>
      ) : null}

      {answer.uncertainty.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text
            style={{ color: COLORS.review, fontSize: 11, fontWeight: "700" }}
          >
            UNCERTAINTY
          </Text>
          {answer.uncertainty.map((item) => (
            <Text
              key={item}
              style={{
                color: COLORS.textMuted,
                fontSize: UI.small,
                lineHeight: 19,
              }}
            >
              – {item}
            </Text>
          ))}
        </View>
      ) : null}

      {answer.nextAction ? (
        <View style={{ gap: 2 }}>
          <Text
            style={{ color: COLORS.textFaint, fontSize: 11, fontWeight: "700" }}
          >
            NEXT ACTION
          </Text>
          <Text
            style={{
              color: COLORS.text,
              fontSize: UI.small,
              fontWeight: "600",
            }}
          >
            {answer.nextAction.label}
          </Text>
          <Text
            style={{
              color: COLORS.textMuted,
              fontSize: UI.small,
              lineHeight: 19,
            }}
          >
            {answer.nextAction.detail}
          </Text>
        </View>
      ) : null}

      {answer.sources.length > 0 ? (
        <View style={{ gap: 2 }}>
          <Text
            style={{ color: COLORS.textFaint, fontSize: 11, fontWeight: "700" }}
          >
            SOURCE INFORMATION
          </Text>
          {answer.sources.map((source) => (
            <View key={source.label} style={{ gap: 5, marginBottom: 8 }}>
              <Text
                style={{
                  color: COLORS.textFaint,
                  fontSize: UI.small,
                  lineHeight: 19,
                }}
              >
                {source.label} — {source.note}
              </Text>
              {source.url ? (
                <ExternalLink
                  href={source.url}
                  style={{ color: COLORS.primarySoft, fontSize: UI.small }}
                >
                  Open agency source ↗
                </ExternalLink>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {answer.actions.map((action) => (
          <GhostButton
            key={`${action.kind}-${action.label}`}
            label={action.label}
            onPress={() => onNavigate(action.route)}
          />
        ))}
      </View>
    </Panel>
  );
}

export default function AssistantScreen() {
  const router = useRouter();
  const { crewId, crewName, activeStream } = useApp();
  const stateQuery = trpc.state.get.useQuery();
  const [threads, setThreads] = useState<Record<string, AssistantMessage[]>>(
    {},
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const contextQuery = trpc.assistant.context.useQuery(
    { crewId: crewId ?? "" },
    { enabled: Boolean(crewId) },
  );
  const ask = trpc.assistant.ask.useMutation();

  const threadKey = useMemo(() => {
    const missionId = stateQuery.data?.applied?.id ?? "no-mission";
    return `${crewId ?? "none"}|${activeStream?.crewId === crewId ? activeStream.id : "baseline"}|${missionId}`;
  }, [
    crewId,
    activeStream?.id,
    activeStream?.crewId,
    stateQuery.data?.applied?.id,
  ]);

  const messages = threads[threadKey] ?? [];

  const send = async (question: string) => {
    if (!crewId || question.trim().length === 0) return;
    setError(null);
    const userMessage: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question.trim(),
      answer: null,
      createdAt: new Date().toISOString(),
    };
    setThreads((current) => ({
      ...current,
      [threadKey]: [...(current[threadKey] ?? []), userMessage],
    }));
    setInput("");
    try {
      const answer = await ask.mutateAsync({
        crewId,
        question: question.trim(),
      });
      const assistantMessage: AssistantMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: answer.summary,
        answer,
        createdAt: new Date().toISOString(),
      };
      setThreads((current) => ({
        ...current,
        [threadKey]: [...(current[threadKey] ?? []), assistantMessage],
      }));
    } catch (askError) {
      setError(
        askError instanceof Error
          ? askError.message
          : "The assistant could not answer.",
      );
    }
  };

  if (!crewId) {
    return (
      <ScreenContainer>
        <ScreenScroll>
          <EmptyState
            icon="psychology"
            title="Select a crew member"
            body="The assistant explains the selected demonstration record."
          />
        </ScreenScroll>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            <View style={{ flex: 1 }} />
            <Chip label="Local only" active tone={COLORS.noFlags} />
          </View>

          <View>
            <Text
              style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}
            >
              Baymax assistant
            </Text>
            <Text
              style={{
                color: COLORS.textFaint,
                fontSize: UI.tiny,
                marginTop: 3,
                lineHeight: 16,
              }}
            >
              Local explanations generated from predefined logic and your
              selected demonstration record. No model, no API, no data leaves
              the app.
            </Text>
            <Text
              style={{
                color: COLORS.roseSoft,
                fontSize: UI.tiny,
                marginTop: 4,
              }}
            >
              Context: {crewName} ·{" "}
              {activeStream?.crewId === crewId
                ? `stream ${activeStream.label}`
                : "baseline stream"}{" "}
              · rule set {contextQuery.data?.ruleSetVersion ?? "—"}
            </Text>
          </View>

          <Panel soft style={{ gap: 8 }}>
            <SectionTitle
              title="Ask about this record"
              hint="Tap a starting question or type your own."
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(contextQuery.data?.suggestions ?? [])
                .slice(0, 6)
                .map((question) => (
                  <Chip
                    key={question}
                    label={question}
                    onPress={() => send(question)}
                  />
                ))}
            </View>
          </Panel>

          {messages.length === 0 ? (
            <Notice title="Conversations are kept separate">
              A new thread starts when the astronaut, applied mission or data
              stream changes, so context is never mixed.
            </Notice>
          ) : null}

          {ask.isPending ? (
            <LoadingState label="Explaining from your record" />
          ) : null}
          {error ? (
            <Notice tone="danger" title="Cannot answer">
              {error}
            </Notice>
          ) : null}

          <View style={{ gap: 10 }}>
            {messages.map((message) =>
              message.role === "user" ? (
                <View
                  key={message.id}
                  style={{
                    alignSelf: "flex-end",
                    backgroundColor: `${COLORS.primary}44`,
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    maxWidth: "90%",
                  }}
                >
                  <Text style={{ color: COLORS.text, fontSize: UI.body }}>
                    {message.text}
                  </Text>
                </View>
              ) : message.answer ? (
                <AnswerCard
                  key={message.id}
                  answer={message.answer}
                  onNavigate={(route) => router.push(route as never)}
                />
              ) : null,
            )}
          </View>

          <Panel soft style={{ gap: 8 }}>
            <AppTextInput
              value={input}
              onChangeText={setInput}
              placeholder="e.g. why is this astronaut at risk?"
              multiline
              style={{ minHeight: 56, textAlignVertical: "top" }}
            />
            <View
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <PrimaryButton
                label="Ask"
                icon="send"
                onPress={() => send(input)}
                disabled={input.trim().length === 0}
                loading={ask.isPending}
              />
              <Pressable
                onPress={() =>
                  setThreads((current) => ({ ...current, [threadKey]: [] }))
                }
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.textFaint, fontSize: UI.tiny }}>
                  Clear this thread
                </Text>
              </Pressable>
            </View>
          </Panel>

          <Text
            style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}
          >
            The assistant reframes diagnostic questions as observed concerns,
            never invents findings or citations, and never authorises an EVA.
            Unsupported questions are declined with the supported topics.
          </Text>
        </ScreenScroll>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
