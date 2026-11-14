import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

const STORAGE_KEY = "celestial.selectedCrewId";

export type AppContextValue = {
  crewId: string | null;
  crewName: string | null;
  setCrewId: (id: string) => void;
  crewList: { id: string; displayName: string; callSign: string; archived: boolean }[];
  stateQuery: ReturnType<typeof trpc.state.get.useQuery>;
  meta: { ruleSetVersion: string; seedVersion: string; timezone: string } | null;
  activeStream: { id: string; label: string; crewId: string } | null;
  appliedMissionName: string | null;
  refreshAll: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [crewId, setCrewIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const utils = trpc.useUtils();
  const stateQuery = trpc.state.get.useQuery(undefined, { staleTime: 15_000 });

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && value) setCrewIdState(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const crewList = stateQuery.data?.crew ?? [];

  useEffect(() => {
    if (!hydrated) return;
    if (crewList.length === 0) return;
    const exists = crewList.some((member) => member.id === crewId);
    if (!exists) {
      const next = crewList.find((member) => !member.archived) ?? crewList[0];
      setCrewIdState(next.id);
      AsyncStorage.setItem(STORAGE_KEY, next.id).catch(() => undefined);
    }
  }, [crewList, crewId, hydrated]);

  const setCrewId = useCallback(
    (id: string) => {
      setCrewIdState(id);
      AsyncStorage.setItem(STORAGE_KEY, id).catch(() => undefined);
      utils.invalidate();
    },
    [utils],
  );

  const refreshAll = useCallback(() => {
    utils.invalidate();
  }, [utils]);

  const value = useMemo<AppContextValue>(() => {
    const stream = stateQuery.data?.stream ?? null;
    const selected = crewList.find((member) => member.id === crewId) ?? null;
    return {
      crewId,
      crewName: selected?.displayName ?? null,
      setCrewId,
      crewList,
      stateQuery,
      meta: stateQuery.data?.meta ?? null,
      activeStream:
        stream && stateQuery.data?.state.activeStreamId === stream.id
          ? { id: stream.id, label: stream.label, crewId: stream.crewId }
          : null,
      appliedMissionName: stateQuery.data?.applied?.name ?? null,
      refreshAll,
    };
  }, [crewId, crewList, setCrewId, stateQuery, refreshAll]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
