import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Alert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { clearOwnerToken } from "@/lib/owner-token";
import { useApp } from "@/lib/app-context";
import { shareBinaryFile, shareTextFile } from "@/lib/files";
import {
  AppTextInput,
  COLORS,
  DangerButton,
  FieldLabel,
  GhostButton,
  Notice,
  Panel,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import { formatDateTime } from "@/shared/format";
import { trpc } from "@/lib/trpc";

export default function SettingsScreen() {
  const router = useRouter();
  const { crewId, meta, refreshAll } = useApp();
  const utils = trpc.useUtils();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const about = trpc.state.about.useQuery();
  const status = trpc.owner.status.useQuery();
  const logout = trpc.owner.logout.useMutation();
  const reset = trpc.state.resetDemo.useMutation();

  const exportObservations = async () => {
    if (!crewId) return;
    setBusy("obs");
    try {
      const result = await utils.client.exports.observationsCsv.query({ crewId });
      setMessage(await shareTextFile(result.filename, result.csv));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The export failed.");
    } finally {
      setBusy(null);
    }
  };

  const exportBundle = async () => {
    if (!crewId) return;
    setBusy("json");
    try {
      const result = await utils.client.exports.bundleJson.query({ crewId });
      setMessage(await shareTextFile(result.filename, result.json, "application/json"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The export failed.");
    } finally {
      setBusy(null);
    }
  };

  const [backupSummary, setBackupSummary] = useState<string | null>(null);

  const exportSqlite = async () => {
    setBusy("sqlite");
    try {
      const result = await utils.client.exports.sqliteBackup.mutate();
      const tables = Object.keys(result.counts).length;
      setBackupSummary(
        `${result.format === "sqlite" ? "SQLite database" : "SQL dump"}: ${result.totalRows} rows across ${tables} tables, generated ${formatDateTime(result.generatedAt)}.`,
      );
      setMessage(await shareBinaryFile(result.filename, result.base64, result.mimeType));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The backup could not be generated.");
    } finally {
      setBusy(null);
    }
  };

  const doSignOut = async () => {
    await logout.mutateAsync();
    await clearOwnerToken();
    await utils.invalidate();
  };

  const doReset = () => {
    if (confirmation.trim() !== "RESET DEMO") {
      Alert.alert("Confirmation required", 'Type RESET DEMO exactly to reset the fictional dataset.');
      return;
    }
    Alert.alert(
      "Reset the demonstration dataset?",
      "Crew profiles, observations, cases, handovers, simulations and import batches created in this environment are replaced by the seeded fictional set. Your owner passphrase is kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await reset.mutateAsync({ confirm: "RESET DEMO" });
              await utils.invalidate();
              refreshAll();
              setConfirmation("");
              Alert.alert("Reset complete", "The seeded fictional dataset was restored.");
            } catch (error) {
              Alert.alert("Reset failed", error instanceof Error ? error.message : "Unknown error");
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer>
      <ScreenScroll>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <GhostButton label="Back" icon="arrow-back" onPress={() => router.back()} />
        </View>
        <Text style={{ color: COLORS.text, fontSize: 22, fontWeight: "700" }}>Settings, rules and limitations</Text>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Owner session" hint="Backend-validated, expiring sessions." />
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small }}>
            Signed in as {status.data?.displayName ?? "owner"} ·{" "}
            {status.data?.sessionExpiresAt ? `expires ${formatDateTime(status.data.sessionExpiresAt)}` : "no active expiry"}
          </Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
            Passphrase hash: scrypt with a per-account salt. Session tokens are random, stored hashed and expire after 12
            hours. Logging out revokes the session server-side.
          </Text>
          <GhostButton label="Sign out on this device" icon="logout" onPress={doSignOut} />
        </Panel>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Rules and versions" />
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}>
            Rule set {meta?.ruleSetVersion ?? "—"} · seed {meta?.seedVersion ?? "—"} · timezone {meta?.timezone ?? "UTC"}.
            Freshness windows, thresholds and floors are demonstration engineering settings; they are shown separately from
            the concern they create.
          </Text>
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>{about.data?.statement}</Text>
        </Panel>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Exports" hint={`Selected crew: ${crewId ?? "none"}`} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <GhostButton label="Observations CSV" icon="download" onPress={exportObservations} loading={busy === "obs"} />
            <GhostButton label="Assessment JSON" icon="data-object" onPress={exportBundle} loading={busy === "json"} />
          </View>
          {message ? <Notice tone="info" title="Export">{message}</Notice> : null}
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
            CSV cells are neutralised against spreadsheet formula injection. Exports include the source, unit and stream of
            every observation, plus the rule-set version used for the assessment snapshot.
          </Text>
        </Panel>

        <Panel style={{ gap: 8 }}>
          <SectionTitle
            title="Portable SQLite backup"
            hint="One file with every demonstration table, readable by any SQLite tool."
          />
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 20 }}>
            Downloads a real <Text style={{ fontWeight: "700" }}>.sqlite</Text> database with the crew profiles,
            observations, missions, simulations, cases, checks, handovers, imports and mission logs. Table and column
            names match the supplied Drizzle schema, so the file can be opened in DB Browser for SQLite, the
            <Text style={{ fontWeight: "700" }}> sqlite3</Text> CLI or Drizzle Studio. Timestamps are UTC epoch
            milliseconds.
          </Text>
          <GhostButton
            label="Download SQLite backup"
            icon="archive"
            onPress={exportSqlite}
            loading={busy === "sqlite"}
          />
          {backupSummary ? (
            <Text style={{ color: COLORS.teal, fontSize: UI.small }}>{backupSummary}</Text>
          ) : null}
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
            The backup never includes the owner passphrase, passphrase hash, session tokens or account rows. Restore by
            opening the file read-only next to a fresh deployment; the running app keeps its managed MySQL database as
            the source of truth. If a runtime has no SQLite module, the same action downloads an equivalent .sql dump
            that recreates the file with sqlite3.
          </Text>
        </Panel>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Demonstration reset" hint="Runs only when you ask for it with the literal confirmation." />
          <FieldLabel hint='Type RESET DEMO to enable the button.'>Confirmation</FieldLabel>
          <AppTextInput value={confirmation} onChangeText={setConfirmation} placeholder="RESET DEMO" autoCapitalize="characters" />
          <DangerButton label="Reset seeded dataset" onPress={doReset} />
          <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
            The seed runs once per installation; relaunching the app never duplicates crew profiles or overwrites your edits.
          </Text>
        </Panel>

        <Panel style={{ gap: 8 }}>
          <SectionTitle title="Honest limitations" />
          {[
            "Software only: no sensors, wearables or camera-based vital signs. All observations are manual, imported or simulated.",
            "No disease prediction, no clinical benefit claim and no flight-readiness certification.",
            "The local database is not encrypted merely because an owner account exists; it is a prototype, not a certified medical record system.",
            "Communication simulation is entirely local: nothing is sent, and fictional ground replies are composed inside the app.",
            "Rule thresholds and freshness windows are illustrative engineering settings, not spaceflight medical standards.",
            "Imported datasets are labelled with their source and batch id; the app never presents imported data as NASA data unless a real NASA source was imported.",
          ].map((item) => (
            <Text key={item} style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>
              • {item}
            </Text>
          ))}
        </Panel>

        <Text style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}>
          Celestial Baymax — a hackathon demonstration for the NASA Space Apps challenge brief. Crew profiles, scenarios and
          ground replies are fictional.
        </Text>
      </ScreenScroll>
    </ScreenContainer>
  );
}
