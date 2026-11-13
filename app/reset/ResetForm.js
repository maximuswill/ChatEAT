"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "./actions";

export default function ResetForm({ token, email }) {
  const [state, formAction, pending] = useActionState(resetPassword, { error: "" });
  return (
    <div className="auth-card">
      <h1>Set a new password</h1>
      <p className="auth-sub">For <strong>{email}</strong>. You&apos;ll be logged out everywhere else.</p>
      <form action={formAction} noValidate>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <input type="hidden" name="token" value={token} />
        <div className="field">
          <label htmlFor="next">New password</label>
          <input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} aria-describedby="next-hint" />
          <span className="hint" id="next-hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="confirm">New password again</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <button className="button primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save and log in"}</button>
      </form>
      <p className="auth-switch"><Link href="/login">Back to log in</Link></p>
    </div>
  );
}
