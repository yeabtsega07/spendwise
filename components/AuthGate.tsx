"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Icon from "./Icon";

export default function AuthGate({ supabase }: { supabase: SupabaseClient }) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function google() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    // otherwise the browser redirects to Google
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    const creds = { email: email.trim(), password };

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword(creds);
      if (error) setError(error.message);
      // success → onAuthStateChange in page.tsx swaps in the app
    } else {
      const { data, error } = await supabase.auth.signUp(creds);
      if (error) setError(error.message);
      else if (!data.session)
        setInfo(
          "Account created! Check your email for a confirmation link, then come back and sign in."
        );
      // if data.session is present, you're logged in immediately
    }
    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <Icon name="wallet" size={32} />
        </div>
        <h1>Spendwise</h1>
        <p className="auth-sub">
          {mode === "signin"
            ? "Welcome back."
            : "Create an account to start tracking your spending."}
        </p>

        <button type="button" className="btn google full" onClick={google}>
          <span className="g-mark">G</span> Continue with Google
        </button>

        <div className="auth-divider">or</div>

        <form onSubmit={submit}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password (at least 6 characters)"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn primary full" disabled={loading}>
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          className="auth-link"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
        >
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>

        {info && (
          <p className="auth-sub" style={{ marginTop: 14 }}>
            {info}
          </p>
        )}
        {error && <p className="auth-error">{error}</p>}
      </div>
    </div>
  );
}
