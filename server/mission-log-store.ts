import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { MissionLog, MissionLogInput } from "../shared/mission-context";
import { missionLogs } from "../drizzle/schema";
import { getDb } from "./db";
import { sqliteTransaction } from "./sqlite";

export async function listMissionLogs(
  crewId: string,
  streamId: string | null,
): Promise<MissionLog[]> {
  const db = await getDb();
  const rows = await db
    .select({ recordJson: missionLogs.recordJson })
    .from(missionLogs)
    .where(
      and(
        eq(missionLogs.crewId, crewId),
        eq(missionLogs.streamKey, streamId ?? "baseline"),
      ),
    )
    .orderBy(desc(missionLogs.observedAt));
  return rows.map((row) => JSON.parse(row.recordJson) as MissionLog);
}

/** All rows commit together; a duplicate returns the existing record without a second event. */
export async function saveMissionLogs(
  inputs: MissionLogInput[],
  streamId: string | null,
  missionId: string | null,
): Promise<{ inserted: MissionLog[]; duplicateCount: number }> {
  const db = await getDb();
  const inserted: MissionLog[] = [];
  let duplicateCount = 0;

  await sqliteTransaction(async () => {
    const tx = db;
    for (const input of inputs) {
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            crewId: input.crewId,
            streamId,
            missionId,
            observedAt: input.observedAt,
            data: input.data,
            note: input.note,
            sourceKind: input.sourceKind,
            sourceLabel: input.sourceLabel,
            sourceRef: input.sourceRef,
          }),
        )
        .digest("hex");
      const existing = await tx
        .select({ id: missionLogs.id })
        .from(missionLogs)
        .where(eq(missionLogs.fingerprint, fingerprint))
        .limit(1);
      if (existing.length > 0) {
        duplicateCount++;
        continue;
      }
      const record: MissionLog = {
        ...input,
        id: `context-${randomUUID()}`,
        streamId,
        missionId,
        createdAt: new Date().toISOString(),
      };
      await tx.insert(missionLogs).values({
        id: record.id,
        crewId: input.crewId,
        streamKey: streamId ?? "baseline",
        missionId,
        observedAt: input.observedAt,
        fingerprint,
        recordJson: JSON.stringify(record),
      });
      inserted.push(record);
    }
  });

  return { inserted, duplicateCount };
}
