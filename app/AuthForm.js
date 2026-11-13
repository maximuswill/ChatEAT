"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { logIn, signUp } from "./actions";

const MODES = {
  signup: {
    action: signUp,
    title: "Create your account",
    sub: "Start planning meals that fit your life.",
    button: "Create account",
    busy: "Creating account…",
    passwordAutocomplete: "new-password",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
  login: {
    action: logIn,
    title: "Welcome back",
    sub: "Log in to see your week.",
    button: "Log in",
    busy: "Logging in…",
    passwordAutocomplete: "current-password",
    switchText: "New to ChatEAT?",
    switchLink: "Create an account",
    switchHref: "/signup",
  },
};

export default function AuthForm({ mode }) {
  const m = MODES[mode];
  const [state, formAction, pending] = useActionState(m.action, { error: "", email: "" });

  return (
    <div className="auth-card">
      <h1>{m.title}</h1>
      <p className="auth-sub">{m.sub}</p>
      <form action={formAction} noValidate>
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.email ?? ""} key={state?.email ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete={m.passwordAutocomplete} required minLength={mode === "signup" ? 8 : undefined} aria-describedby={mode === "signup" ? "password-hint" : undefined} />
          {mode === "signup" && <span className="hint" id="password-hint">At least 8 characters.</span>}
        </div>
        {mode === "signup" && <CodeField initial={state?.code ?? ""} />}
        <button className="button primary" type="submit" disabled={pending}>{pending ? m.busy : m.button}</button>
      </form>
      <p className="auth-switch">{m.switchText} <Link href={m.switchHref}>{m.switchLink}</Link></p>
    </div>
  );
}

// Hidden behind a link so regular visitors aren't distracted by it.
function CodeField({ initial }) {
  const [open, setOpen] = useState(Boolean(initial));
  if (!open) {
    return <button type="button" className="code-toggle" onClick={() => setOpen(true)}>Have a friends &amp; family code?</button>;
  }
  return (
    <div className="field">
      <label htmlFor="code">Friends &amp; family code</label>
      <input id="code" name="code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} defaultValue={initial} key={initial} autoFocus={!initial} aria-describedby="code-hint" />
      <span className="hint" id="code-hint">Gives you free access. Leave it blank if you don&apos;t have one.</span>
    </div>
  );
}
