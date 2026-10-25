"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/format";

export default function SignupPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = { name: form.get("name"), email: form.get("email"), password: form.get("password") };
    try {
      await api("/api/auth/signup", { method: "POST", body });
      const res = await signIn("credentials", { email: body.email, password: body.password, redirect: false });
      if (!res?.ok) throw new Error("Account created. Please log in.");
      window.location.href = "/onboarding";
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
        <h1 className="text-2xl font-semibold">Create account</h1>
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
          {error ? <p className="text-sm text-[#8B3A3A]">{error}</p> : null}
          <Button disabled={busy} type="submit">
            {busy ? "Creating…" : "Sign up"}
          </Button>
        </form>
        <p className="mt-4 text-sm">
          Already registered? <Link className="text-cyan" href="/login">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
