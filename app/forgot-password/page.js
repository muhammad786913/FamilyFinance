"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Alert } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/format";

export default function ForgotPage() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("info");

  async function onSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await api("/api/auth/forgot-password", {
        method: "POST",
        body: { email: form.get("email"), website: form.get("website") },
      });
      setTone("info");
      setMessage(data.message || "If that account exists, a reset email was sent.");
    } catch (err) {
      setTone("warn");
      setMessage(err.message);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-4">
      <Logo className="mb-6 justify-center" />
      <Card>
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <input className="hidden" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <Button type="submit">Send reset link</Button>
        </form>
        {message ? (
          <div className="mt-4">
            <Alert title={tone === "warn" ? "Email was not sent" : "Check your inbox"} tone={tone}>
              {message}
            </Alert>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
