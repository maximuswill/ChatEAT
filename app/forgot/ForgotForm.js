"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset } from "../reset/actions";

export default function ForgotForm() {
  const [state, formAction, pending] = useActionState(requestReset, { error: "", email: "" });

  if (state?.sent) {
    return (
      <div className="auth-card">
        <h1>Request sent</h1>
        <p className="auth-sub">If <strong>{state.email}</strong> has a ChatEAT account, Maximus has been told and will send you a link to set a new password, usually by text.</p>
        <p className="auth-sub">The link works once and lasts 24 hours.</p>
        <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
      </div>
    );
  }
  return (
    <div className="auth-card">
      <h1>Forgot your password?</h1>
      <p className="auth-sub">Enter the email you signed up with. Maximus will send you a link to set a new one.</p>
      <form action={formAction} noValidate>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email ?? ""} key={state?.email ?? ""} />
        </div>
        <button className="button primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Ask for a reset link"}</button>
      </form>
      <p className="auth-switch">Remembered it? <Link href="/login">Log in</Link></p>
    </div>
  );
}
