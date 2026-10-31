"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/format";

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState(params.get("email") || "");
  const [state, setState] = useState(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api("/api/auth/verify-email", { method: "POST", body: { token } })
      .then(() => {
        if (!alive) return;
        setState("done");
        setMessage("Email verified. You can log in now.");
      })
      .catch((err) => {
        if (!alive) return;
        setState("failed");
        setMessage(err.message);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function resend(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/auth/resend-verification", {
        method: "POST",
        body: { email, website: new FormData(event.currentTarget).get("website") },
      });
      setMessage(result.message || "If that address needs verification, a new link was sent.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-4">
      <Logo className="mb-6 justify-center" />
      <Card>
        <h1 className="text-2xl font-semibold">Email verification</h1>
        {state === "verifying" ? <p className="mt-3 text-sm">Checking your link…</p> : null}
        {state === "done" ? (
          <>
            <p className="mt-3 text-sm text-[#1F6B4F]">{message}</p>
            <Link className="mt-4 inline-block font-semibold text-cyan" href="/login">
              Go to log in →
            </Link>
          </>
        ) : null}
        {state === "failed" ? <p className="mt-3 text-sm text-[#8B3A3A]">{message}</p> : null}
        {state !== "done" ? (
          <form className="mt-4 grid gap-3" onSubmit={resend}>
            <p className="text-sm text-navy/80">
              Need a new link? Enter the email address you signed up with.
            </p>
            <Field label="Email" htmlFor="verify-email">
              <Input
                id="verify-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <input className="hidden" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <Button disabled={busy} type="submit">
              {busy ? "Sending…" : "Resend verification email"}
            </Button>
            {message ? <p className="text-sm" role="status">{message}</p> : null}
          </form>
        ) : null}
        <p className="mt-4 text-sm">
          <Link className="text-cyan" href="/login">
            Back to log in
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="mx-auto grid min-h-screen max-w-md content-center px-4"><p>Loading…</p></main>}>
      <VerifyInner />
    </Suspense>
  );
}
