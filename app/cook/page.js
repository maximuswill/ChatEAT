import Link from "next/link";
import AppBar from "../AppBar";
import CookClient from "./CookClient";
import { requireMember } from "../../lib/auth";
import { getProfile } from "../../lib/profile";
import { hardRules } from "../../lib/allergens";
import { aiStatus } from "../../lib/recipe-ai";
import "./cook.css";

export const metadata = { title: "What should I make? · ChatEAT" };

export default async function CookPage() {
  const user = await requireMember();
  const profile = await getProfile(user.id);

  return (
    <>
      <AppBar email={user.email} current="/cook" />
      <main className="app-main">
        <div className="container cook">
          <h1>What should I make?</h1>
          <p className="cook-intro">Describe what you&apos;re craving, what you have and how much time you&apos;ve got. ChatEAT uses your kitchen profile, so you don&apos;t have to repeat yourself.</p>

          {!user.has_paid_access ? (
            <p className="notice">Recipe ideas are part of the paid plan. Payments are coming soon.</p>
          ) : (
            <>
              {!profile.completed && (
                <p className="notice">
                  Recipes fit you much better once your kitchen profile is set up. <Link href="/onboarding">Build it now</Link> (about 5 minutes).
                </p>
              )}
              <CookClient rules={hardRules(profile.data)} aiState={await aiStatus()} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
