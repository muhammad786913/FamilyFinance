"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/format";

function ResetForm() {
  const params = useSearchParams();
  const [message, setMessage] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { token: params.get("token"), password: form.get("password") },
      });
      setMessage("Password updated. You can log in.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        <Field label="New password" htmlFor="password">
          <Input id="password" name="password" type="password" minLength={8} required />
        </Field>
        <Button type="submit">Update password</Button>
      </form>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </Card>
  );
}

export default function ResetPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-4">
      <Suspense fallback={<p>Loading…</p>}>
        <ResetForm />
      </Suspense>
    </main>
  );
}
