import { ReactNode, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { setOwnerToken } from "@/lib/owner-token";
import { trpc } from "@/lib/trpc";
import {
  AppTextInput,
  COLORS,
  FieldLabel,
  GhostButton,
  Notice,
  Panel,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  UI,
} from "@/lib/ui";

function OwnerAccess({ hasOwner }: { hasOwner: boolean }) {
  const utils = trpc.useUtils();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setup = trpc.owner.setup.useMutation();
  const login = trpc.owner.login.useMutation();

  const submit = async () => {
    setError(null);
    if (!hasOwner && passphrase !== confirm) {
      setError("The two passphrases do not match.");
      return;
    }
    if (passphrase.trim().length < 10) {
      setError("Use a passphrase of at least 10 characters.");
      return;
    }
    try {
      const result = hasOwner
        ? await login.mutateAsync({ passphrase })
        : await setup.mutateAsync({ passphrase, displayName: displayName.trim() || "Owner" });
      await setOwnerToken(result.token);
      await utils.invalidate();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The owner session could not be established.");
    }
  };

  return (
    <ScreenScroll contentStyle={{ justifyContent: "center", flexGrow: 1, gap: 14, paddingTop: 40 }}>
      <View>
        <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: "700" }}>Celestial Baymax</Text>
        <Text style={{ color: COLORS.roseSoft, fontSize: 11, letterSpacing: 1.6, fontWeight: "700", marginTop: 3 }}>
          PREDICT. PREVENT. PROTECT. RECOVER.
        </Text>
      </View>

      <Panel style={{ gap: 12 }}>
        <SectionTitle
          title={hasOwner ? "Owner sign-in" : "Create the local owner account"}
          hint={
            hasOwner
              ? "Sessions are validated by the backend and expire after 12 hours."
              : "There is no default or embedded password. Choose your own passphrase; it is stored only as a scrypt hash."
          }
        />
        {!hasOwner ? (
          <>
            <FieldLabel>Display name (optional)</FieldLabel>
            <AppTextInput value={displayName} onChangeText={setDisplayName} placeholder="e.g. Flight surgeon on call" />
          </>
        ) : null}
        <FieldLabel hint="At least 10 characters. This build is a prototype, not a certified record system.">Passphrase</FieldLabel>
        <AppTextInput value={passphrase} onChangeText={setPassphrase} secureTextEntry placeholder="Your owner passphrase" />
        {!hasOwner ? (
          <>
            <FieldLabel>Confirm passphrase</FieldLabel>
            <AppTextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat the passphrase" />
          </>
        ) : null}

        {error ? <Notice tone="danger" title="Cannot continue">{error}</Notice> : null}

        <PrimaryButton
          label={hasOwner ? "Sign in" : "Create owner account"}
          icon={hasOwner ? "login" : "person-add"}
          onPress={submit}
          loading={setup.isPending || login.isPending}
        />
        <Text style={{ color: COLORS.textFaint, fontSize: 11, lineHeight: 15 }}>
          Owner access exists so demonstration records are not readable by anyone who opens the URL. It is not an audited
          clinical authentication system, and the database itself is not encrypted at rest.
        </Text>
      </Panel>

      <Notice tone="warning" title="Demonstration only">
        All crew profiles, observations and ground replies in this app are fictional. Nothing is transmitted, and no real
        medical records should be entered.
      </Notice>
    </ScreenScroll>
  );
}

export function OwnerGate({ children }: { children: ReactNode }) {
  const status = trpc.owner.status.useQuery(undefined, { retry: false, staleTime: 10_000 });

  if (status.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24, backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.rose} />
        <Text style={{ color: COLORS.textFaint, fontSize: UI.small }}>Checking the local owner session</Text>
      </View>
    );
  }

  if (status.isError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: COLORS.background }}>
        <Panel style={{ gap: 10 }}>
          <Text style={{ color: COLORS.priority, fontWeight: "700" }}>The local API is not reachable</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: UI.small, lineHeight: 19 }}>{status.error.message}</Text>
          <GhostButton label="Try again" icon="refresh" onPress={() => status.refetch()} />
        </Panel>
      </View>
    );
  }

  if (!status.data?.authenticated) {
    return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <OwnerAccess hasOwner={Boolean(status.data?.hasOwner)} />
    </View>
  );
  }

  return <View style={{ flex: 1, backgroundColor: COLORS.background }}>{children}</View>;
}
