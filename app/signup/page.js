import { redirect } from "next/navigation";
import Brand from "../Brand";
import AuthForm from "../AuthForm";
import { getCurrentUser } from "../../lib/auth";

export const metadata = { title: "Sign up · ChatEAT" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="auth-page">
      <Brand />
      <AuthForm mode="signup" />
    </main>
  );
}
