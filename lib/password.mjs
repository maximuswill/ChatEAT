// Password hashing shared by the app (lib/auth.js) and the scripts in scripts/.
// Stored as "scrypt$<salt>$<hash>". The plain password is never saved.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hashHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password.normalize("NFKC"), salt, expected.length);
  return timingSafeEqual(actual, expected);
}
