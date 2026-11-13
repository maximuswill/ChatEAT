import Brand from "../Brand";
import ForgotForm from "./ForgotForm";

export const metadata = { title: "Forgot password · ChatEAT" };

export default function ForgotPage() {
  return (
    <main className="auth-page">
      <Brand />
      <ForgotForm />
    </main>
  );
}
