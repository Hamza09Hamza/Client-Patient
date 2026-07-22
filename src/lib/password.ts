import { randomInt, timingSafeEqual } from "crypto";

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
 * Constant-time comparison against the stored plaintext password, so a
 * failed login can't be timed to leak how many leading characters matched.
 */
export function verifyPassword(submitted: string, stored: string): boolean {
  const a = Buffer.from(submitted);
  const b = Buffer.from(stored);
  if (a.length !== b.length) {
    // still run a comparison of equal length so the branch above doesn't
    // itself become a length oracle
    timingSafeEqual(Buffer.alloc(b.length), Buffer.alloc(b.length));
    return false;
  }
  return timingSafeEqual(a, b);
}
