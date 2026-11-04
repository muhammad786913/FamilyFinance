"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/format";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      website: form.get("website"),
    };
    try {
      const result = await api("/api/auth/signup", { method: "POST", body });
      // Verification is optional, so sign the new account in immediately and go
      // straight to setup. This avoids a dead end when email delivery is not
      // configured (no link arrives, but the account is ready to use).
      const login = await signIn("credentials", {
        email: body.email,
        password: body.password,
        website: body.website,
        redirect: false,
      });
      if (!login?.ok) {
        setFallback({ email: String(body.email || ""), message: result?.message });
        return;
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-4">
      <Logo className="mb-6 justify-center" />
      <Card>
        {fallback ? (
          <div className="grid gap-3">
            <h1 className="text-2xl font-semibold">Account created</h1>
            <p className="text-sm">{fallback.message || "Your account is ready."}</p>
            <p className="text-sm text-navy/75">
              We could not sign you in automatically. Log in with the same email and password to start setup.
            </p>
            <Link className="font-semibold text-cyan" href={`/login?email=${encodeURIComponent(fallback.email)}`}>
              Go to log in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Create account</h1>
            <p className="mt-1 text-sm text-navy/70">
              Takes about two minutes. You will set up your household right after this.
            </p>
            <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" required />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Password" htmlFor="password" hint="At least 8 characters">
                <Input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
              </Field>
              <input className="hidden" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              {error ? <p className="text-sm text-[#8B3A3A]">{error}</p> : null}
              <Button disabled={busy} type="submit">
                {busy ? "Creating your account…" : "Sign up"}
              </Button>
            </form>
            <p className="mt-4 text-sm">
              Already registered?{" "}
              <Link className="text-cyan" href="/login">
                Log in
              </Link>
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
