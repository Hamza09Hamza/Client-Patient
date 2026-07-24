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

const CODE_ALPHABET = UPPER + LOWER + DIGIT;
const CODE_LENGTH = 8;

/**
 * Generates a short, simple 8-character code from mixed-case letters and
 * digits (without guaranteeing every class in each code), with no dashes or
 * grouping — ~46 bits of entropy, easy to read off a printed
 * report and type back in. Used for both generated usernames and passwords
 * (generatePassword / generateUsername below) so patient login is quick on
 * a phone keyboard: two short codes rather than one long one.
 */
function generateCode(): string {
  return pick(CODE_ALPHABET, CODE_LENGTH);
}

/** A patient's login identifier — generated once at initial provisioning. */
export function generateUsername(): string {
  return generateCode();
}

export function generatePassword(): string {
  return generateCode();
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
  if (
    !salt ||
    !hashHex ||
    !/^[0-9a-f]{32}$/i.test(salt) ||
    !/^[0-9a-f]{128}$/i.test(hashHex)
  ) {
    return false;
  }
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(submitted, salt, SCRYPT_KEYLEN)) as Buffer;
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
