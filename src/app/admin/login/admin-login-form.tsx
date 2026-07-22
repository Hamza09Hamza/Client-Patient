"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import { adminLogin, type AuthFormState } from "@/lib/actions/auth";
import { Field, PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(adminLogin, {});

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
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />
      <PasswordField label="Password" name="password" autoComplete="current-password" required />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Sign in to console
        {!pending && <LogIn aria-hidden className="size-4" />}
      </Button>
    </form>
  );
}
