import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

/**
 * QR single-report sharing. A grant is a scoped, revocable bearer credential
 * for exactly one report — minted at push time (see
 * src/app/api/integration/reports/route.ts) and handed to the patient as a
 * QR code encoding `{origin}/r/{publicId}#t={token}`.
 *
 * The plaintext token only ever exists in memory at mint time and inside the
 * QR itself — the database stores only its SHA-256 hash, so a QR image can
 * never be regenerated from a stored grant, only reissued as a new one.
 */

const PUBLIC_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const GRANT_LIFETIME_DAYS = 30;
const SHARE_SESSION_MINUTES = 60;

export const SHARE_COOKIE = "report_share_session";
export const SHARE_SESSION_SECONDS = SHARE_SESSION_MINUTES * 60;

function generatePublicId(): string {
  const bytes = randomBytes(6);
  let id = "RPT-";
  for (const b of bytes) id += PUBLIC_ID_ALPHABET[b % PUBLIC_ID_ALPHABET.length];
  return id;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export interface ShareGrant {
  publicId: string;
  /** plaintext — only available here, right after minting; never persisted */
  token: string;
  expiresAt: Date;
}

/** Mints a new share grant for a report. Retries on the (vanishingly rare) publicId collision. */
export async function createShareGrant(labResultId: string): Promise<ShareGrant> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + GRANT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const publicId = generatePublicId();
    try {
      await db.reportShareGrant.create({ data: { publicId, labResultId, tokenHash, expiresAt } });
      return { publicId, token, expiresAt };
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  throw new Error("Could not allocate a share id.");
}

/** True when a grant exists, isn't revoked, and hasn't expired — the DB is always the source of truth for revocation. */
export async function isGrantActive(publicId: string): Promise<{ labResultId: string } | null> {
  const grant = await db.reportShareGrant.findUnique({
    where: { publicId },
    select: { labResultId: true, revokedAt: true, expiresAt: true },
  });
  if (!grant || grant.revokedAt || grant.expiresAt < new Date()) return null;
  return { labResultId: grant.labResultId };
}

/** Validates a QR token against the stored grant and records the redemption. Never persists the token itself. */
export async function redeemShareGrant(
  publicId: string,
  token: string,
): Promise<{ labResultId: string } | null> {
  const grant = await db.reportShareGrant.findUnique({ where: { publicId } });
  if (!grant || grant.revokedAt || grant.expiresAt < new Date()) return null;

  try {
    const candidate = Buffer.from(hashToken(token), "hex");
    const stored = Buffer.from(grant.tokenHash, "hex");
    if (!timingSafeEqual(candidate, stored)) return null;
  } catch {
    return null;
  }

  await db.reportShareGrant.update({
    where: { publicId },
    data: { redemptionCount: { increment: 1 }, lastAccessedAt: new Date() },
  });

  return { labResultId: grant.labResultId };
}

/** Short-lived session proving this browser already exchanged the QR token for this specific report. */
export async function signShareSession(publicId: string, labResultId: string): Promise<string> {
  return new SignJWT({ publicId, labResultId, purpose: "report-share" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SHARE_SESSION_MINUTES}m`)
    .sign(secretKey());
}

/** Returns the session's labResultId when the token is valid and scoped to this exact publicId. */
export async function verifyShareSession(token: string, publicId: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.purpose === "report-share" && payload.publicId === publicId && typeof payload.labResultId === "string") {
      return payload.labResultId;
    }
    return null;
  } catch {
    return null;
  }
}
