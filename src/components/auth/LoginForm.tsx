"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const registered = searchParams.get("registered");
  const registeredEmail = searchParams.get("email");

  const [email, setEmail] = useState(registeredEmail || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Image src="/logo.png" alt="SketchTrude" width={32} height={32} />
          <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            SketchTrude
          </span>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to access your projects and studio.</p>

        {registered === "verify" && (
          <div className="auth-notice" role="status">
            <strong>Check your email to verify your account</strong>
            We sent a confirmation link
            {registeredEmail ? ` to ${registeredEmail}` : ""}. Open that email, confirm your
            address, then sign in below.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link href="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
