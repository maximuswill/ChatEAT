"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "../actions";

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, {});
  const formRef = useRef(null);

  // Clear the fields after a successful change.
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="account-form">
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      {state?.success && <p className="notice ok" role="status">{state.success}</p>}
      <div className="field">
        <label htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required aria-describedby="next-hint" />
        <span className="hint" id="next-hint">At least 8 characters.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button className="button primary small" type="submit" disabled={pending}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}
