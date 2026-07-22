import { ShieldAlert } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

interface CredentialRevealProps {
  patientId: string;
  password: string;
  /** "generated" for a brand-new password, "viewed" for recalling the existing one */
  mode?: "generated" | "viewed";
}

/**
 * Credential panel shown after generating or viewing a patient's password.
 * Every view is written to the audit log — see viewPatientPassword().
 */
export function CredentialReveal({ patientId, password, mode = "generated" }: CredentialRevealProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        <p className="text-[13px] leading-relaxed text-ink">
          {mode === "generated" ? (
            <>
              <span className="font-semibold">New credentials generated.</span> Hand them to
              the patient through a channel you trust.
            </>
          ) : (
            <>
              <span className="font-semibold">Current credentials.</span> This view was
              recorded in the audit log.
            </>
          )}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-canvas p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Patient ID
            </p>
            <p className="tnum truncate font-semibold text-ink">{patientId}</p>
          </div>
          <CopyButton value={patientId} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Password
            </p>
            <p className="tnum truncate font-mono text-[15px] font-semibold text-primary-deep">
              {password}
            </p>
          </div>
          <CopyButton value={password} />
        </div>
        <div className="border-t border-border pt-3">
          <CopyButton
            value={`Patient portal access\nID: ${patientId}\nPassword: ${password}`}
            label="Copy both"
          />
        </div>
      </div>
    </div>
  );
}
