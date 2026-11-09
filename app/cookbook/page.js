import Link from "next/link";
import AppBar from "../AppBar";
import RecipeCard from "../RecipeCard";
import { removeSavedRecipe } from "../actions";
import { requireMember } from "../../lib/auth";
import { sql } from "../../lib/db";
import "../cook/cook.css";

export const metadata = { title: "Cookbook · ChatEAT" };

export default async function CookbookPage() {
  const user = await requireMember();
  const rows = await sql`select id, recipe from saved_recipes where user_id = ${user.id} order by created_at desc`;

  return (
    <>
      <AppBar email={user.email} current="/cookbook" />
      <main className="app-main">
        <div className="container cook">
          <h1>My cookbook</h1>
          <p className="cook-intro">Recipes you&apos;ve saved, all in one place.</p>
          {rows.length === 0 ? (
            <p className="cook-empty">Nothing saved yet. <Link href="/cook">Find something to make</Link> and tap &ldquo;Save to cookbook.&rdquo;</p>
          ) : (
            <div className="cook-list">
              {rows.map((row) => (
                <RecipeCard
                  key={row.id}
                  recipe={row.recipe}
                  saved
                  footer={
                    <form action={removeSavedRecipe.bind(null, row.id)}>
                      <button type="submit" className="button outline small">Remove</button>
                    </form>
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
