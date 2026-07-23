import { randomInt, randomBytes, timingSafeEqual, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEYLEN = 64;

// Unambiguous alphabet: no 0/O, 1/l/I, or symbols that get mangled when
// credentials are read over the phone or copied from a printout.
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGIT = "23456789";

function pick(pool: string, n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += pool[randomInt(pool.length)];
  return out;
}

/**
 * Generates a strong but communicable password: three 4-char groups
 * (e.g. "Kt7m-Rx4q-Wn9d"), ~62 bits of entropy, each group mixing cases
 * and a digit so common complexity policies are satisfied.
 */
export function generatePassword(): string {
  const group = () => {
    const chars = [pick(UPPER, 1), pick(LOWER, 1), pick(DIGIT, 1), pick(UPPER + LOWER + DIGIT, 1)];
    // shuffle inside the group so the pattern position isn't fixed
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  };
  return [group(), group(), group()].join("-");
}

/**
 * Hashes a password for storage: scrypt with a random 16-byte salt, encoded
 * as "salt:hash" (both hex) so the salt travels with the hash in a single
 * column. The plaintext this was generated from is only ever available in
 * memory right here, at generation time — capture and return it to the
 * caller then, because it can never be recovered from the stored hash
 * afterward (see AGENTS.md and docs/API.md).
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(plain, salt, SCRYPT_KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time verification against a "salt:hash" value from hashPassword. */
export async function verifyPasswordHash(submitted: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(submitted, salt, expected.length)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
