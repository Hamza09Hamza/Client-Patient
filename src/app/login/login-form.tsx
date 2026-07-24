"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { patientLogin, type AuthFormState } from "@/lib/actions/auth";
import { Field, PasswordField } from "@/components/ui/field";
import { SpecularButton } from "@/components/rb/specular-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function LoginForm({ dict }: { dict: Dictionary["login"] }) {
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
        label={dict.usernameLabel}
        name="username"
        placeholder={dict.usernamePlaceholder}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        hint={dict.usernameHint}
      />

      <PasswordField label={dict.passwordLabel} name="password" autoComplete="current-password" required />

      <SpecularButton type="submit" size="lg" loading={pending}>
        {dict.signInButton}
        {!pending && <ArrowRight aria-hidden className="size-4" />}
      </SpecularButton>

      <p className="text-center text-sm text-ink-muted">{dict.forgotPasswordText}</p>
    </form>
  );
}
