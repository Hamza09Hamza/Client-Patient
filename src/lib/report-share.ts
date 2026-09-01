import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * QR single-report sharing. A grant is a scoped, revocable bearer credential
 * for exactly one report — minted the moment the report's slot is created
 * (see src/app/api/integration/reports/route.ts, which now mints it at
 * appointment/pre-registration time, before any PDF exists) and handed to the
 * patient as a QR code encoding `{origin}/r/{publicId}#t={token}`.
 *
 * Verification (redeemShareGrant) only ever compares against tokenHash — a
 * one-way SHA-256 digest — exactly like password verification in
 * src/lib/password.ts. Separately, tokenEncrypted holds an AES-256-GCM
 * ciphertext of the same token, keyed by REPORT_SHARE_ENCRYPTION_KEY. That
 * column exists for exactly one reason: the physical card handed to the
 * patient at intake already has this QR printed on it, so once the PDF
 * arrives later we must hand back the *same* URL, not mint a different one
 * that wouldn't match the printed code. getOrMintShareGrant() is the only
 * thing that reads it.
 */

const PUBLIC_ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const GRANT_LIFETIME_DAYS = 30;
const SHARE_SESSION_MINUTES = 60 * 6; // 6 hours — long enough that a patient reading their own report doesn't get logged out and need to rescan the QR mid-read
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_AUTH_TAG_BYTES = 16;

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

/** SHA-256 of the configured secret, giving exactly the 32 bytes AES-256 requires regardless of the env var's own length. */
function encryptionKey(): Buffer {
  const secret = process.env.REPORT_SHARE_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("REPORT_SHARE_ENCRYPTION_KEY must be set to a random string of at least 32 characters");
  }
  return createHash("sha256").update(secret).digest();
}

/** Exported for testing round-trip + tamper behavior without a database. */
export function encryptToken(token: string): string {
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Returns null on any decryption failure (wrong/rotated key, corrupted data) so callers can fall back to minting fresh. */
export function decryptToken(encrypted: string): string | null {
  try {
    const raw = Buffer.from(encrypted, "base64");
    // Reject anything too short for a full-length IV + auth tag up front —
    // otherwise a truncated tag reaches setAuthTag() below, which Node now
    // warns is deprecated (it silently accepted short GCM tags historically).
    if (raw.length < ENCRYPTION_IV_BYTES + ENCRYPTION_AUTH_TAG_BYTES) return null;
    const iv = raw.subarray(0, ENCRYPTION_IV_BYTES);
    const authTag = raw.subarray(ENCRYPTION_IV_BYTES, ENCRYPTION_IV_BYTES + ENCRYPTION_AUTH_TAG_BYTES);
    const ciphertext = raw.subarray(ENCRYPTION_IV_BYTES + ENCRYPTION_AUTH_TAG_BYTES);
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export interface ShareGrant {
  publicId: string;
  /** plaintext — only available here, right after minting or decrypting; never persisted as such */
  token: string;
  expiresAt: Date;
  /** true when an existing grant was reissued rather than freshly minted */
  reused: boolean;
}

/** Mints a new share grant for a report. Retries on the (vanishingly rare) publicId collision. */
export async function createShareGrant(labResultId: string): Promise<ShareGrant> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const tokenEncrypted = encryptToken(token);
  const expiresAt = new Date(Date.now() + GRANT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const publicId = generatePublicId();
    try {
      await db.reportShareGrant.create({ data: { publicId, labResultId, tokenHash, tokenEncrypted, expiresAt } });
      return { publicId, token, expiresAt, reused: false };
    } catch (err) {
      const target =
        err instanceof Prisma.PrismaClientKnownRequestError && Array.isArray(err.meta?.target)
          ? err.meta.target
          : [];
      const publicIdCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        target.includes("publicId");
      if (!publicIdCollision || attempt === 4) throw err;
    }
  }
  throw new Error("Could not allocate a share id.");
}

/**
 * Returns the report's existing active grant (decrypted) when one can be
 * recovered, otherwise mints a new one. This is what makes repeated
 * integration pushes for the same (patientId, externalId) idempotent at the
 * QR level — see src/app/api/integration/reports/route.ts.
 *
 * `refreshExpiry` extends a reused grant's expiry back out to the full
 * lifetime — used specifically when a PDF finally attaches to a report that
 * was pre-registered a while ago, so the printed QR doesn't expire shortly
 * after the patient's result actually becomes available.
 */
export async function getOrMintShareGrant(
  labResultId: string,
  options: { refreshExpiry?: boolean } = {},
): Promise<ShareGrant> {
  const existing = await db.reportShareGrant.findFirst({
    where: { labResultId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (existing?.tokenEncrypted) {
    const token = decryptToken(existing.tokenEncrypted);
    if (token) {
      let expiresAt = existing.expiresAt;
      if (options.refreshExpiry) {
        expiresAt = new Date(Date.now() + GRANT_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
        await db.reportShareGrant.update({ where: { publicId: existing.publicId }, data: { expiresAt } });
      }
      return { publicId: existing.publicId, token, expiresAt, reused: true };
    }
  }

  return createShareGrant(labResultId);
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
