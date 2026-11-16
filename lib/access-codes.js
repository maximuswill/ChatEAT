// Friends & family codes: entered at sign-up (or on the subscribe page) for free access.
// Both codes unlock every feature; they differ only in the weekly AI request cap.
//
// Set them in .env.local and in Vercel (they're settings, not code, so they stay out of the public repo):
//   CHATEAT_CODE_FULL     → 50 AI requests a week, same as a paying member
//   CHATEAT_CODE_LIMITED  → 25 AI requests a week
// Capital letters, spaces and dashes don't matter. Changing a code doesn't affect people who already used it.
import { createHash, timingSafeEqual } from "node:crypto";
import { setting } from "./setting.js";

export const TIERS = {
  family_full: { label: "Friends & family", weeklyAiLimit: 50 },
  family_limited: { label: "Friends & family (limited)", weeklyAiLimit: 25 },
};

const normalize = (code) => String(code ?? "").toUpperCase().replace(/[\s"'-]+/g, ""); // quotes too, in case a setting was pasted with them
const digest = (code) => createHash("sha256").update(normalize(code)).digest();

// Returns "family_full", "family_limited" or null.
export function tierForCode(code) {
  if (!normalize(code)) return null;
  const entered = digest(code);
  const codes = [
    ["family_full", setting("CHATEAT_CODE_FULL")],
    ["family_limited", setting("CHATEAT_CODE_LIMITED")],
  ];
  for (const [tier, real] of codes) {
    if (normalize(real) && timingSafeEqual(entered, digest(real))) return tier;
  }
  return null;
}
