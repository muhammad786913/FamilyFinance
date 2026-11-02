"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/format";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [needsVerify, setNeedsVerify] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNeedsVerify("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    try {
      const res = await signIn("credentials", {
        email,
        password: form.get("password"),
        website: form.get("website"),
        redirect: false,
      });
      if (!res?.ok) {
        if (res?.error === "EmailNotVerified") {
          setNeedsVerify(email);
          setError("Verify your email before logging in.");
          return;
        }
        setError("Email or password is incorrect.");
        return;
      }
      try {
        const home = await api("/api/household");
        window.location.href = home?.household?.setupComplete ? "/dashboard" : "/onboarding";
      } catch {
        window.location.href = "/dashboard";
      }
    } catch {
      // A throttled (429) or unreachable auth endpoint rejects without a JSON body.
      setError("Could not sign in right now. Wait a moment and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-4">
      <Logo className="mb-6 justify-center" />
      <Card>
        <h1 className="text-2xl font-semibold">Log in</h1>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <input className="hidden" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {error ? <p className="text-sm text-[#8B3A3A]">{error}</p> : null}
          {needsVerify ? (
            <p className="text-sm">
              <Link className="text-cyan" href={`/verify-email?email=${encodeURIComponent(needsVerify)}`}>
                Resend the verification email
              </Link>
            </p>
          ) : null}
          <Button disabled={busy} type="submit">
            {busy ? "Signing in…" : "Log in"}
          </Button>
        </form>
        <p className="mt-4 text-sm">
          <Link className="text-cyan" href="/forgot-password">
            Forgot password
          </Link>
        </p>
        <p className="mt-2 text-sm">
          New here? <Link className="text-cyan" href="/signup">Create an account</Link>
        </p>
      </Card>
    </main>
  );
}
