import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useRouter } from "expo-router";
import { z } from "zod";

import {
  AppTextInput,
  COLORS,
  Chip,
  FieldLabel,
  GhostButton,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";
import type { CrewHistory, CrewProfile, YesNoUnknown } from "@/shared/domain";
import { trpc } from "@/lib/trpc";

const YES_NO_UNKNOWN: { value: YesNoUnknown; label: string }[] = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "unknown", label: "Unknown" },
];

export const emptyHistory: CrewHistory = {
  previousConditions: [],
  injuriesSurgeries: [],
  medications: [],
  allergies: [],
  familyHistory: [],
  cardiovascular: { conditions: [], knownHypertension: "unknown", notes: "" },
  boneMuscle: { boneDensityConcern: "unknown", priorFracture: "unknown", muscleLossConcern: "unknown", notes: "" },
  sleepWellbeing: { baselineSleepHours: null, insomniaHistory: "unknown", anxietyHistory: "unknown", notes: "" },
  vision: { correctiveLenses: "unknown", priorVisionChanges: "unknown", notes: "" },
  respiratory: { asthma: "unknown", notes: "" },
  missionHistory: { previousConcerns: [], evaHours: null, notes: "" },
};

type Draft = {
  displayName: string;
  callSign: string;
  role: string;
  age: string;
  sexAtBirth: string;
  heightCm: string;
  weightKg: string;
  bloodType: string;
  missions: string;
  history: CrewHistory;
  medicationsText: string;
  familyText: string;
  conditionsText: string;
  injuriesText: string;
  allergiesText: string;
  concernsText: string;
  cardioConditionsText: string;
};

const SEX_OPTIONS = ["Female", "Male", "Intersex", "Not stated"];
const BLOOD_OPTIONS = ["O+", "O−", "A+", "A−", "B+", "B−", "AB+", "AB−", "Unknown"];

function toDraft(crew?: CrewProfile | null): Draft {
  const history = crew?.history ?? emptyHistory;
  return {
    displayName: crew?.displayName ?? "",
    callSign: crew?.callSign ?? "",
    role: crew?.role ?? "",
    age: crew ? String(crew.age) : "",
    sexAtBirth: crew?.sexAtBirth ?? "Not stated",
    heightCm: crew ? String(crew.heightCm) : "",
    weightKg: crew ? String(crew.weightKg) : "",
    bloodType: crew?.bloodType ?? "Unknown",
    missions: (crew?.missions ?? []).join("\n"),
    history,
    medicationsText: history.medications.map((item) => `${item.name} | ${item.dose} | ${item.schedule}`).join("\n"),
    familyText: history.familyHistory.map((item) => `${item.relationship} | ${item.condition} | ${item.status}`).join("\n"),
    conditionsText: history.previousConditions.join("; "),
    injuriesText: history.injuriesSurgeries.join("; "),
    allergiesText: history.allergies.join("; "),
    concernsText: history.missionHistory.previousConcerns.join("; "),
    cardioConditionsText: history.cardiovascular.conditions.join("; "),
  };
}

const payloadSchema = z.object({
  displayName: z.string().trim().min(2, "Enter the crew member's name (at least 2 characters)."),
  callSign: z.string().trim().min(1, "Enter a call sign."),
  role: z.string().trim().min(1, "Enter a role."),
  age: z.number().int().min(18, "Age must be 18–80.").max(80, "Age must be 18–80."),
  heightCm: z.number().int().min(120, "Height must be 120–220 cm.").max(220, "Height must be 120–220 cm."),
  weightKg: z.number().int().min(35, "Weight must be 35–200 kg.").max(200, "Weight must be 35–200 kg."),
  sexAtBirth: z.string().min(1),
  bloodType: z.string().min(1),
});

function splitList(value: string): string[] {
  return value
    .split(/[;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMedications(value: string): CrewHistory["medications"] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", dose = "", schedule = ""] = line.split("|").map((part) => part.trim());
      return { name, dose, schedule };
    });
}

function parseFamily(value: string): CrewHistory["familyHistory"] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [relationship = "", condition = "", status = "unknown"] = line.split("|").map((part) => part.trim());
      const normalised: YesNoUnknown =
        status.toLowerCase().startsWith("y") ? "yes" : status.toLowerCase().startsWith("n") ? "no" : "unknown";
      return { relationship, condition, status: normalised };
    });
}

function YesNoField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: YesNoUnknown;
  onChange: (value: YesNoUnknown) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {YES_NO_UNKNOWN.map((option) => (
          <Chip key={option.value} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    </View>
  );
}

export function CrewEditor({ crewId }: { crewId?: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"identity" | "history" | "mission">("identity");
  const [draft, setDraft] = useState<Draft>(() => toDraft(null));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const crewQuery = trpc.crew.get.useQuery({ id: crewId ?? "" }, { enabled: Boolean(crewId) });
  const create = trpc.crew.create.useMutation();
  const update = trpc.crew.update.useMutation();

  useEffect(() => {
    if (crewQuery.data) setDraft(toDraft(crewQuery.data));
  }, [crewQuery.data]);

  const update_ = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const updateHistory = <K extends keyof CrewHistory>(key: K, value: CrewHistory[K]) => {
    setDraft((current) => ({ ...current, history: { ...current.history, [key]: value } }));
    setDirty(true);
  };

  const save = async () => {
    setNotice(null);
    const parsedNumbers = payloadSchema.safeParse({
      displayName: draft.displayName,
      callSign: draft.callSign,
      role: draft.role,
      age: Number(draft.age),
      heightCm: Number(draft.heightCm),
      weightKg: Number(draft.weightKg),
      sexAtBirth: draft.sexAtBirth,
      bloodType: draft.bloodType,
    });
    if (!parsedNumbers.success) {
      const fieldErrors: Record<string, string> = {};
      parsedNumbers.error.issues.forEach((issue) => {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      setNotice("Some fields need attention. Values entered on other tabs were kept.");
      return;
    }
    setErrors({});

    const history: CrewHistory = {
      ...draft.history,
      previousConditions: splitList(draft.conditionsText),
      injuriesSurgeries: splitList(draft.injuriesText),
      allergies: splitList(draft.allergiesText),
      medications: parseMedications(draft.medicationsText),
      familyHistory: parseFamily(draft.familyText),
      cardiovascular: { ...draft.history.cardiovascular, conditions: splitList(draft.cardioConditionsText) },
      missionHistory: {
        ...draft.history.missionHistory,
        previousConcerns: splitList(draft.concernsText),
        evaHours: draft.history.missionHistory.evaHours,
      },
    };

    const payload = {
      displayName: parsedNumbers.data.displayName,
      callSign: parsedNumbers.data.callSign,
      role: parsedNumbers.data.role,
      age: parsedNumbers.data.age,
      sexAtBirth: parsedNumbers.data.sexAtBirth,
      heightCm: parsedNumbers.data.heightCm,
      weightKg: parsedNumbers.data.weightKg,
      bloodType: parsedNumbers.data.bloodType,
      missions: draft.missions
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      history,
    };

    try {
      if (crewId) {
        await update.mutateAsync({ id: crewId, ...payload });
      } else {
        const created = await create.mutateAsync(payload);
        await utils.crew.list.invalidate();
        router.replace(`/crew/${created.id}`);
        return;
      }
      await utils.crew.list.invalidate();
      await utils.crew.items.invalidate();
      await utils.state.get.invalidate();
      setDirty(false);
      router.back();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The profile could not be saved.");
    }
  };

  const cancel = () => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert("Discard changes?", "Unsaved edits to this profile will be lost.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  };

  if (crewId && crewQuery.isLoading) {
    return <Notice title="Loading profile">Fetching the stored crew record.</Notice>;
  }

  return (
    <ScreenScroll>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Chip label="Identity" active={tab === "identity"} onPress={() => setTab("identity")} />
        <Chip label="Medical history" active={tab === "history"} onPress={() => setTab("history")} />
        <Chip label="Mission" active={tab === "mission"} onPress={() => setTab("mission")} />
      </View>

      {notice ? <Notice tone="danger" title="Cannot save yet">{notice}</Notice> : null}
      {Object.keys(errors).length > 0 ? (
        <Notice tone="danger" title="Validation">
          {Object.entries(errors)
            .map(([field, message]) => `${field}: ${message}`)
            .join("\n")}
        </Notice>
      ) : null}

      {tab === "identity" ? (
        <Panel style={{ gap: 12 }}>
          <SectionTitle title="Identity" hint="Fictional demonstration profile. Do not enter real medical records." />
          <FieldLabel>Full name</FieldLabel>
          <AppTextInput
            value={draft.displayName}
            onChangeText={(value) => update_("displayName", value)}
            placeholder="e.g. Maya Chen"
            invalid={Boolean(errors.displayName)}
          />
          <FieldLabel>Call sign</FieldLabel>
          <AppTextInput value={draft.callSign} onChangeText={(value) => update_("callSign", value)} placeholder="e.g. Aster" invalid={Boolean(errors.callSign)} />
          <FieldLabel>Role</FieldLabel>
          <AppTextInput value={draft.role} onChangeText={(value) => update_("role", value)} placeholder="e.g. Mission commander" invalid={Boolean(errors.role)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <FieldLabel>Age (years)</FieldLabel>
              <AppTextInput
                value={draft.age}
                onChangeText={(value) => update_("age", value.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                invalid={Boolean(errors.age)}
                placeholder="41"
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <FieldLabel>Height (cm)</FieldLabel>
              <AppTextInput
                value={draft.heightCm}
                onChangeText={(value) => update_("heightCm", value.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                invalid={Boolean(errors.heightCm)}
                placeholder="168"
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <FieldLabel>Weight (kg)</FieldLabel>
              <AppTextInput
                value={draft.weightKg}
                onChangeText={(value) => update_("weightKg", value.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                invalid={Boolean(errors.weightKg)}
                placeholder="62"
              />
            </View>
          </View>
          <FieldLabel>Sex at birth</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {SEX_OPTIONS.map((option) => (
              <Chip key={option} label={option} active={draft.sexAtBirth === option} onPress={() => update_("sexAtBirth", option)} />
            ))}
          </View>
          <FieldLabel>Blood type</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {BLOOD_OPTIONS.map((option) => (
              <Chip key={option} label={option} active={draft.bloodType === option} onPress={() => update_("bloodType", option)} />
            ))}
          </View>
          <FieldLabel hint="One mission per line.">Missions</FieldLabel>
          <AppTextInput
            value={draft.missions}
            onChangeText={(value) => update_("missions", value)}
            multiline
            style={{ minHeight: 80, textAlignVertical: "top" }}
            placeholder={"Lunar Gateway · 190 d\nISS Expedition 71"}
          />
        </Panel>
      ) : null}

      {tab === "history" ? (
        <>
          <Panel style={{ gap: 12 }}>
            <SectionTitle title="Conditions and events" hint="Separate entries with a semicolon." />
            <FieldLabel>Previous conditions</FieldLabel>
            <AppTextInput
              value={draft.conditionsText}
              onChangeText={(value) => update_("conditionsText", value)}
              placeholder="e.g. Hypertension, managed; Migraine"
              multiline
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
            <FieldLabel>Injuries and surgeries</FieldLabel>
            <AppTextInput
              value={draft.injuriesText}
              onChangeText={(value) => update_("injuriesText", value)}
              placeholder="e.g. Right wrist fracture (2019, healed)"
              multiline
              style={{ minHeight: 56, textAlignVertical: "top" }}
            />
            <FieldLabel>Allergies</FieldLabel>
            <AppTextInput
              value={draft.allergiesText}
              onChangeText={(value) => update_("allergiesText", value)}
              placeholder="e.g. Penicillin"
            />
            <FieldLabel hint="One per line: name | dose | schedule">Medications</FieldLabel>
            <AppTextInput
              value={draft.medicationsText}
              onChangeText={(value) => update_("medicationsText", value)}
              placeholder={"Amlodipine | 5 mg | Daily 08:00"}
              multiline
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
            <FieldLabel hint="One per line: relationship | condition | yes/no/unknown">Family history</FieldLabel>
            <AppTextInput
              value={draft.familyText}
              onChangeText={(value) => update_("familyText", value)}
              placeholder={"Father | Myocardial infarction at 58 | yes"}
              multiline
              style={{ minHeight: 72, textAlignVertical: "top" }}
            />
          </Panel>

          <Panel style={{ gap: 12 }}>
            <SectionTitle title="Domain history" hint="Unknown is a valid answer and is never treated as normal." />
            <FieldLabel>Cardiovascular conditions</FieldLabel>
            <AppTextInput
              value={draft.cardioConditionsText}
              onChangeText={(value) => update_("cardioConditionsText", value)}
              placeholder="e.g. Documented hypertension"
            />
            <YesNoField
              label="Known hypertension"
              value={draft.history.cardiovascular.knownHypertension}
              onChange={(value) =>
                updateHistory("cardiovascular", { ...draft.history.cardiovascular, knownHypertension: value })
              }
            />
            <FieldLabel>Cardiovascular notes</FieldLabel>
            <AppTextInput
              value={draft.history.cardiovascular.notes}
              onChangeText={(value) => updateHistory("cardiovascular", { ...draft.history.cardiovascular, notes: value })}
              multiline
              style={{ minHeight: 56, textAlignVertical: "top" }}
            />

            <View style={{ height: 1, backgroundColor: COLORS.border }} />
            <YesNoField
              label="Bone density concern"
              value={draft.history.boneMuscle.boneDensityConcern}
              onChange={(value) => updateHistory("boneMuscle", { ...draft.history.boneMuscle, boneDensityConcern: value })}
            />
            <YesNoField
              label="Prior fracture"
              value={draft.history.boneMuscle.priorFracture}
              onChange={(value) => updateHistory("boneMuscle", { ...draft.history.boneMuscle, priorFracture: value })}
            />
            <YesNoField
              label="Muscle-loss concern"
              value={draft.history.boneMuscle.muscleLossConcern}
              onChange={(value) => updateHistory("boneMuscle", { ...draft.history.boneMuscle, muscleLossConcern: value })}
            />

            <View style={{ height: 1, backgroundColor: COLORS.border }} />
            <FieldLabel hint="Leave empty if the baseline was never recorded.">Baseline sleep (hours)</FieldLabel>
            <AppTextInput
              value={draft.history.sleepWellbeing.baselineSleepHours === null ? "" : String(draft.history.sleepWellbeing.baselineSleepHours)}
              onChangeText={(value) => {
                const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
                updateHistory("sleepWellbeing", {
                  ...draft.history.sleepWellbeing,
                  baselineSleepHours: parsed === null || Number.isNaN(parsed) ? null : parsed,
                });
              }}
              keyboardType="decimal-pad"
              placeholder="e.g. 7.2"
            />
            <YesNoField
              label="Insomnia history"
              value={draft.history.sleepWellbeing.insomniaHistory}
              onChange={(value) => updateHistory("sleepWellbeing", { ...draft.history.sleepWellbeing, insomniaHistory: value })}
            />
            <YesNoField
              label="Anxiety history"
              value={draft.history.sleepWellbeing.anxietyHistory}
              onChange={(value) => updateHistory("sleepWellbeing", { ...draft.history.sleepWellbeing, anxietyHistory: value })}
            />

            <View style={{ height: 1, backgroundColor: COLORS.border }} />
            <YesNoField
              label="Corrective lenses"
              value={draft.history.vision.correctiveLenses}
              onChange={(value) => updateHistory("vision", { ...draft.history.vision, correctiveLenses: value })}
            />
            <YesNoField
              label="Prior vision changes"
              value={draft.history.vision.priorVisionChanges}
              onChange={(value) => updateHistory("vision", { ...draft.history.vision, priorVisionChanges: value })}
            />
            <FieldLabel>Vision notes</FieldLabel>
            <AppTextInput
              value={draft.history.vision.notes}
              onChangeText={(value) => updateHistory("vision", { ...draft.history.vision, notes: value })}
              multiline
              style={{ minHeight: 52, textAlignVertical: "top" }}
            />

            <View style={{ height: 1, backgroundColor: COLORS.border }} />
            <YesNoField
              label="Asthma"
              value={draft.history.respiratory.asthma}
              onChange={(value) => updateHistory("respiratory", { ...draft.history.respiratory, asthma: value })}
            />
            <FieldLabel>Respiratory notes</FieldLabel>
            <AppTextInput
              value={draft.history.respiratory.notes}
              onChangeText={(value) => updateHistory("respiratory", { ...draft.history.respiratory, notes: value })}
              multiline
              style={{ minHeight: 52, textAlignVertical: "top" }}
            />
          </Panel>
        </>
      ) : null}

      {tab === "mission" ? (
        <Panel style={{ gap: 12 }}>
          <SectionTitle title="Mission history" hint="Used by the bone, conditioning and sleep screens." />
          <FieldLabel hint="Separate entries with a semicolon.">Previous mission health concerns</FieldLabel>
          <AppTextInput
            value={draft.concernsText}
            onChangeText={(value) => update_("concernsText", value)}
            placeholder="e.g. Sleep debt during handover week"
            multiline
            style={{ minHeight: 64, textAlignVertical: "top" }}
          />
          <FieldLabel hint="Leave empty if unknown.">Accumulated EVA hours</FieldLabel>
          <AppTextInput
            value={draft.history.missionHistory.evaHours === null ? "" : String(draft.history.missionHistory.evaHours)}
            onChangeText={(value) => {
              const parsed = value.trim() === "" ? null : Number(value.replace(",", "."));
              updateHistory("missionHistory", {
                ...draft.history.missionHistory,
                evaHours: parsed === null || Number.isNaN(parsed) ? null : parsed,
              });
            }}
            keyboardType="decimal-pad"
            placeholder="e.g. 26"
          />
          <FieldLabel>Mission notes</FieldLabel>
          <AppTextInput
            value={draft.history.missionHistory.notes}
            onChangeText={(value) => updateHistory("missionHistory", { ...draft.history.missionHistory, notes: value })}
            multiline
            style={{ minHeight: 64, textAlignVertical: "top" }}
          />
        </Panel>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <PrimaryButton
          label={crewId ? "Save profile" : "Create profile"}
          onPress={save}
          loading={create.isPending || update.isPending}
          icon="save"
        />
        <GhostButton label="Cancel" onPress={cancel} />
      </View>
      <Text style={{ color: COLORS.textFaint, fontSize: UI.small, lineHeight: 19 }}>
        All tabs are validated together on save, so switching tabs never discards entered values. Stored values remain
        editable medical history, not validated clinical data.
      </Text>
    </ScreenScroll>
  );
}
