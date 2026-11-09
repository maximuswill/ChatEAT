import AppBar from "../AppBar";
import PantryClient from "./PantryClient";
import { requireMember } from "../../lib/auth";
import { getPantry } from "../../lib/pantry";
import "../onboarding/onboarding.css";
import "../cook/cook.css";
import "./pantry.css";

export const metadata = { title: "My pantry · ChatEAT" };

export default async function PantryPage() {
  const user = await requireMember();
  const pantry = await getPantry(user.id);

  return (
    <>
      <AppBar email={user.email} current="/pantry" />
      <main className="app-main">
        <div className="container cook">
          <h1>My pantry</h1>
          <p className="cook-intro">Optional. A rough list of what you have, so ChatEAT can suggest recipes that use it. It doesn&apos;t need to be exact.</p>
          <PantryClient initial={pantry} />
        </div>
      </main>
    </>
  );
}
