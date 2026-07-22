import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

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

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
