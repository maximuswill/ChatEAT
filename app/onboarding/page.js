import { redirect } from "next/navigation";
import Brand from "../Brand";
import Onboarding from "./Onboarding";
import "./onboarding.css";
import { getCurrentUser } from "../../lib/auth";
import { getProfile } from "../../lib/profile";

export const metadata = { title: "Your kitchen profile · ChatEAT" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);

  return (
    <div className="ob-page">
      <header className="ob-header container">
        <Brand />
      </header>
      <main className="container">
        <Onboarding initialData={profile.data} completed={profile.completed} email={user.email} />
      </main>
    </div>
  );
}
