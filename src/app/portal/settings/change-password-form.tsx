"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { changePassword, type ChangePasswordState } from "./actions";
import { PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ChangePasswordForm({ dict }: { dict: Dictionary["portalSettings"] }) {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    {},
  );

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
      {state.ok && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent-soft px-3.5 py-3 text-sm font-medium text-accent-strong"
        >
          <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          {dict.successMessage}
        </div>
      )}

      <PasswordField label={dict.currentPassword} name="current" autoComplete="current-password" required />
      <PasswordField
        label={dict.newPassword}
        name="next"
        autoComplete="new-password"
        required
        hint={dict.newPasswordHint}
      />
      <PasswordField label={dict.confirmPassword} name="confirm" autoComplete="new-password" required />

      <Button type="submit" loading={pending}>
        <KeyRound aria-hidden className="size-4" />
        {dict.updateButton}
      </Button>
    </form>
  );
}
