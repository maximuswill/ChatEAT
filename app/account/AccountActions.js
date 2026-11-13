"use client";

import { useActionState, useState } from "react";
import { cancelSubscription, deleteAccount } from "../actions";

// "Cancel subscription" with a second "are you sure?" step.
export function CancelSubscription() {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return <button type="button" className="button outline small" onClick={() => setAsking(true)}>Cancel subscription</button>;
  }
  return (
    <div className="account-confirm">
      <p><strong>Cancel your subscription?</strong> You won&apos;t be charged again, and you keep access until the end of the month you&apos;ve already paid for. You can undo it any time before then.</p>
      <div className="account-confirm-buttons">
        <form action={cancelSubscription}>
          <button className="button danger small" type="submit">Yes, cancel</button>
        </form>
        <button type="button" className="button outline small" onClick={() => setAsking(false)}>Keep my plan</button>
      </div>
    </div>
  );
}

// "Delete my account": password plus typing DELETE.
export function DeleteAccount({ hasSubscription }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, { error: "" });
  if (!open) {
    return <button type="button" className="button outline small danger-outline" onClick={() => setOpen(true)}>Delete my account</button>;
  }
  return (
    <form action={formAction} className="account-form account-confirm">
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <p>
        This permanently erases your account, kitchen profile, cookbook, pantry and meal plans. It can&apos;t be undone.
        {hasSubscription && " Your subscription will be canceled right away, with no refund for the rest of this period."}
      </p>
      <div className="field">
        <label htmlFor="delete-password">Your password</label>
        <input id="delete-password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="delete-confirm">Type DELETE to confirm</label>
        <input id="delete-confirm" name="confirm" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
      </div>
      <div className="account-confirm-buttons">
        <button className="button danger small" type="submit" disabled={pending}>{pending ? "Deleting…" : "Delete forever"}</button>
        <button type="button" className="button outline small" onClick={() => setOpen(false)}>Never mind</button>
      </div>
    </form>
  );
}
