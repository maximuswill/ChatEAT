"use client";

import { useState, useTransition } from "react";
import { dismissResetRequest, makeResetLink } from "../reset/actions";

// One waiting "Forgot password?" request: make a one-time link to send them, or dismiss it.
export default function ResetRequest({ id, userId, email, asked }) {
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (result?.dismissed) return null;
  return (
    <li className="owner-reset">
      <div className="owner-reset-head">
        <span><strong className="owner-email">{email}</strong> <span className="owner-recipe-meta">asked {asked}</span></span>
        {!result?.link && (
          <span className="owner-reset-buttons">
            <button type="button" className="button primary small" disabled={pending} onClick={() => start(async () => setResult(await makeResetLink(userId)))}>
              {pending ? "Making…" : "Make reset link"}
            </button>
            <button type="button" className="button outline small" disabled={pending} onClick={() => start(async () => { await dismissResetRequest(id); setResult({ dismissed: true }); })}>
              Dismiss
            </button>
          </span>
        )}
      </div>
      {result?.error && <p className="form-error">{result.error}</p>}
      {result?.link && (
        <div className="owner-reset-link">
          <p>Send this to {result.email}. It works once and expires in {result.hours} hours. It won&apos;t be shown again.</p>
          <div className="sub-code-row">
            <input readOnly value={result.link} onFocus={(e) => e.target.select()} aria-label="Reset link" />
            <button type="button" className="button outline small" onClick={async () => { try { await navigator.clipboard.writeText(result.link); setCopied(true); } catch {} }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
