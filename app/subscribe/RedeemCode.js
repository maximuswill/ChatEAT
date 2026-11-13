"use client";

import { useActionState, useState } from "react";
import { redeemCode } from "../actions";

// "Have a friends & family code?" on the subscribe page.
export default function RedeemCode() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(redeemCode, { error: "" });

  if (!open) {
    return <button type="button" className="code-toggle sub-code-toggle" onClick={() => setOpen(true)}>Have a friends &amp; family code?</button>;
  }
  return (
    <form action={formAction} className="sub-code">
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <label htmlFor="code">Friends &amp; family code</label>
      <div className="sub-code-row">
        <input id="code" name="code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus required />
        <button className="button outline small" type="submit" disabled={pending}>{pending ? "Checking…" : "Use code"}</button>
      </div>
    </form>
  );
}
