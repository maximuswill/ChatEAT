import { setting } from "./setting.js";
// The site owner's account(s). Owners skip the weekly AI cap and the monthly AI pause,
// see the credit meter in the top bar, and can open /owner (spending, customers, recipe library).
//
// Set CHATEAT_OWNER_EMAIL in .env.local and in Vercel. Several owners: separate emails with commas.
// It's a setting instead of code so the email never lands in the public GitHub repo.
// Quotes and spaces are ignored, in case the value was pasted as "name@example.com".
const OWNER_EMAILS = setting("CHATEAT_OWNER_EMAIL")
  .split(",")
  .map((email) => email.replace(/["'\s]/g, "").toLowerCase())
  .filter(Boolean);

export function isOwner(user) {
  return Boolean(user?.email) && OWNER_EMAILS.includes(String(user.email).toLowerCase());
}

// The credit loaded in the Anthropic Console, in US dollars. The site can't see top-ups,
// so raise CHATEAT_AI_CREDIT_USD when you add more.
export const AI_CREDIT_USD = Number(setting("CHATEAT_AI_CREDIT_USD").replace(/["'$\s]/g, "")) || 5;
