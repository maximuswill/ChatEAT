import { setting } from "./setting.js";
// Emails the site owner (CHATEAT_OWNER_EMAIL), e.g. when someone asks for a password reset.
//
// Uses Resend (resend.com, free tier). Set RESEND_API_KEY in .env.local and in Vercel.
// Without your own domain, Resend can only send to the email you signed up with — which is
// all this needs, since it only ever emails you. Without a key, nothing is sent (requests
// still show on the Owner page).
const OWNER_EMAILS = setting("CHATEAT_OWNER_EMAIL").split(",").map((e) => e.replace(/["'\s]/g, "")).filter(Boolean);

export async function emailOwner(subject, text) {
  if (!setting("RESEND_API_KEY") || OWNER_EMAILS.length === 0) {
    console.log(`[owner email not sent: RESEND_API_KEY or CHATEAT_OWNER_EMAIL missing] ${subject}`);
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${setting("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: setting("CHATEAT_EMAIL_FROM") || "ChatEAT <onboarding@resend.dev>", to: OWNER_EMAILS, subject, text }),
    });
    if (!response.ok) console.error("Owner email failed", response.status, await response.text());
    return response.ok;
  } catch (error) {
    console.error("Owner email failed", error?.message);
    return false;
  }
}
