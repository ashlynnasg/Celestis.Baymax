import superjson from "superjson";
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { getDb as getDatabase } from "./db";

import { ownerSessions, owners } from "../drizzle/schema";

const SESSION_TTL_MINUTES = 12 * 60;
const SCRYPT_KEYLEN = 64;

function getDb() {
  return getDatabase();
}

export function hashPassphrase(passphrase: string, salt: string): string {
  return scryptSync(passphrase.normalize("NFKC"), salt, SCRYPT_KEYLEN).toString(
    "hex",
  );
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export type OwnerStatus = {
  hasOwner: boolean;
  authenticated: boolean;
  displayName: string | null;
  sessionExpiresAt: string | null;
  sessionTtlMinutes: number;
};

export async function readOwnerStatus(
  token: string | null,
): Promise<OwnerStatus> {
  const db = await getDb();
  const ownerRows = await db.select().from(owners).limit(1);
  if (ownerRows.length === 0) {
    return {
      hasOwner: false,
      authenticated: false,
      displayName: null,
      sessionExpiresAt: null,
      sessionTtlMinutes: SESSION_TTL_MINUTES,
    };
  }
  const owner = ownerRows[0];
  if (!token) {
    return {
      hasOwner: true,
      authenticated: false,
      displayName: owner.displayName,
      sessionExpiresAt: null,
      sessionTtlMinutes: SESSION_TTL_MINUTES,
    };
  }
  const session = await findSession(token);
  return {
    hasOwner: true,
    authenticated: Boolean(session),
    displayName: owner.displayName,
    sessionExpiresAt: session ? session.expiresAt.toISOString() : null,
    sessionTtlMinutes: SESSION_TTL_MINUTES,
  };
}

async function findSession(token: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(ownerSessions)
    .where(
      and(
        eq(ownerSessions.tokenHash, hashToken(token)),
        isNull(ownerSessions.revokedAt),
        gt(ownerSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (rows.length === 0) return null;
  const session = rows[0];
  // Sliding last-seen marker only; expiry stays absolute so a stolen token cannot live forever.
  await db
    .update(ownerSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(ownerSessions.id, session.id));
  return session;
}

export async function setupOwner(
  passphrase: string,
  displayName: string,
): Promise<{ token: string; expiresAt: string }> {
  if (passphrase.trim().length < 10) {
    throw new Error("Choose a passphrase of at least 10 characters.");
  }
  const db = await getDb();
  const existing = await db.select({ id: owners.id }).from(owners).limit(1);
  if (existing.length > 0) {
    throw new Error(
      "An owner account already exists on this installation. Sign in instead.",
    );
  }
  const salt = randomBytes(16).toString("hex");
  const ownerId = `owner-${randomUUID().slice(0, 8)}`;
  await db.insert(owners).values({
    id: ownerId,
    displayName: displayName.trim() || "Owner",
    salt,
    passphraseHash: hashPassphrase(passphrase, salt),
    createdAt: new Date(),
    lastLoginAt: new Date(),
  });
  return issueSession(ownerId);
}

export async function loginOwner(
  passphrase: string,
): Promise<{ token: string; expiresAt: string }> {
  const db = await getDb();
  const ownerRows = await db.select().from(owners).limit(1);
  if (ownerRows.length === 0) {
    throw new Error(
      "No owner account exists yet. Complete the one-time setup first.",
    );
  }
  const owner = ownerRows[0];
  const candidate = hashPassphrase(passphrase, owner.salt);
  if (!safeEqualHex(candidate, owner.passphraseHash)) {
    throw new Error("That passphrase does not match the stored owner account.");
  }
  await db
    .update(owners)
    .set({ lastLoginAt: new Date() })
    .where(eq(owners.id, owner.id));
  return issueSession(owner.id);
}

async function issueSession(
  ownerId: string,
): Promise<{ token: string; expiresAt: string }> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);
  await db.insert(ownerSessions).values({
    id: `sess-${randomUUID().slice(0, 12)}`,
    ownerId,
    tokenHash: hashToken(token),
    createdAt: new Date(),
    expiresAt,
    lastSeenAt: new Date(),
    revokedAt: null,
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function logoutOwner(token: string | null): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db
    .update(ownerSessions)
    .set({ revokedAt: new Date() })
    .where(eq(ownerSessions.tokenHash, hashToken(token)));
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (
    typeof header === "string" &&
    header.toLowerCase().startsWith("bearer ")
  ) {
    const value = header.slice(7).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * Central authorization gate for every tRPC call except the owner endpoints themselves.
 * Consistent backend enforcement matters more than hiding buttons in the client.
 */
export function createOwnerGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = req.path.replace(/^\//, "");
      const procedures = path.split(",").map((part) => part.split("?")[0]);
      const isPublic = procedures.every(
        (procedure) =>
          procedure.startsWith("owner.") || procedure.startsWith("system."),
      );
      if (isPublic) {
        next();
        return;
      }
      const session = await findSession(bearerToken(req) ?? "");
      if (!session) {
        const errors = procedures.map((procedure) => ({
          error: superjson.serialize({
            message:
              "Owner session required. Sign in on this device to read or change demonstration records.",
            code: -32001,
            data: { code: "UNAUTHORIZED", httpStatus: 401, path: procedure },
          }),
        }));
        res.status(401).json(req.query.batch === "1" ? errors : errors[0]);
        return;
      }
      next();
    } catch (error) {
      res.status(500).json({
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Authorization check failed.",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    }
  };
}
