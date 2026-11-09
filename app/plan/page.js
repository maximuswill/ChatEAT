import Link from "next/link";
import AppBar from "../AppBar";
import PlanClient from "./PlanClient";
import { requireMember } from "../../lib/auth";
import { sql } from "../../lib/db";
import { getProfile } from "../../lib/profile";
import { hardRules } from "../../lib/allergens";
import { pantryNames } from "../../lib/pantry";
import "../cook/cook.css";
import "./plan.css";

export const metadata = { title: "Plan my week · ChatEAT" };

export default async function PlanPage() {
  const user = await requireMember();
  const profile = await getProfile(user.id);
  const [row] = await sql`select plan from meal_plans where user_id = ${user.id}`;

  return (
    <>
      <AppBar email={user.email} current="/plan" />
      <main className="app-main">
        <div className="container plan">
          <h1>Plan my week</h1>
          <p className="cook-intro">Tell ChatEAT what your week looks like. Meals with a reason get pinned to their day; everything else is yours to fill from this week&apos;s options. They&apos;re suggestions, so swap or clear anything.</p>
          {!user.has_paid_access ? (
            <p className="notice">Plan my week is part of the paid plan.</p>
          ) : (
            <>
              {!profile.completed && (
                <p className="notice">
                  Plans fit you much better once your kitchen profile is set up. <Link href="/onboarding">Build it now</Link> (about 5 minutes).
                </p>
              )}
              <PlanClient
                initialPlan={row?.plan ?? null}
                rules={hardRules(profile.data)}
                pantry={await pantryNames(user.id)}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}
