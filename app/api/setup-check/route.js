// Setup check: shows whether the site can see each setting (yes/no only, never the values),
// which deployment is running, and whether the logged-in account counts as the owner.
// Open https://<your-site>/api/setup-check while logged in.
import { getCurrentUser } from "../../../lib/auth";
import { isOwner } from "../../../lib/owner";

export const dynamic = "force-dynamic";

const has = (name) => Boolean(String(process.env[name] ?? "").replace(/["'\s]/g, ""));

export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  const ownerSetting = String(process.env.CHATEAT_OWNER_EMAIL ?? "");
  return Response.json({
    deployment: {
      environment: process.env.VERCEL_ENV ?? "local",
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "unknown",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? "unknown",
    },
    settingsFound: {
      CHATEAT_OWNER_EMAIL: has("CHATEAT_OWNER_EMAIL"),
      CHATEAT_AI_CREDIT_USD: has("CHATEAT_AI_CREDIT_USD"),
      CHATEAT_CODE_FULL: has("CHATEAT_CODE_FULL"),
      CHATEAT_CODE_LIMITED: has("CHATEAT_CODE_LIMITED"),
      RESEND_API_KEY: has("RESEND_API_KEY"),
      DATABASE_URL: has("DATABASE_URL"),
    },
    // Shape of the owner setting without revealing it: how many emails, and whether each looks like one.
    ownerSettingShape: ownerSetting
      ? ownerSetting.split(",").map((e) => (/^[^@\s"']+@[^@\s"']+\.[a-z]+$/i.test(e.replace(/["'\s]/g, "")) ? "looks like an email" : "does not look like an email"))
      : [],
    you: user ? { loggedIn: true, countsAsOwner: isOwner(user) } : { loggedIn: false },
  });
}
