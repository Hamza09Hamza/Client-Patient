"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { patientLogin, type AuthFormState } from "@/lib/actions/auth";
import { Field, PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(patientLogin, {});

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Field
        label="Patient ID"
        name="username"
        placeholder="e.g. PAT-2026-0001"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        hint="The identifier printed on your clinic card or lab receipt."
      />

      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Sign in
        {!pending && <ArrowRight aria-hidden className="size-4" />}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Lost your password?{" "}
        <Link
          href="/forgot-password"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Request a reset
        </Link>
      </p>
    </form>
  );
}
