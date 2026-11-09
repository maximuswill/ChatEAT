import { redirect } from "next/navigation";
import Brand from "../Brand";
import AuthForm from "../AuthForm";
import { getCurrentUser } from "../../lib/auth";

export const metadata = { title: "Log in · ChatEAT" };

export default async function LogInPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="auth-page">
      <Brand />
      <AuthForm mode="login" />
    </main>
  );
}
