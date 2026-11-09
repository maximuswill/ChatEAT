"use client";

import Link from "next/link";
import { useActionState } from "react";
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
        <button className="button primary" type="submit" disabled={pending}>{pending ? m.busy : m.button}</button>
      </form>
      <p className="auth-switch">{m.switchText} <Link href={m.switchHref}>{m.switchLink}</Link></p>
    </div>
  );
}
