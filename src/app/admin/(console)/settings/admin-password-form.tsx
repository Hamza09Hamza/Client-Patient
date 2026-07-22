"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { changeAdminPassword, type AdminActionState } from "@/lib/actions/admin";
import { PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function AdminPasswordForm() {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    changeAdminPassword,
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
          Console password updated.
        </div>
      )}

      <PasswordField label="Current password" name="current" autoComplete="current-password" required />
      <PasswordField
        label="New password"
        name="next"
        autoComplete="new-password"
        required
        hint="At least 12 characters, with letters and numbers."
      />
      <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" required />

      <Button type="submit" loading={pending}>
        <KeyRound aria-hidden className="size-4" />
        Update password
      </Button>
    </form>
  );
}
