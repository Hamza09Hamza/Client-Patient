import { ShieldAlert } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";

interface CredentialRevealProps {
  patientId: string;
  password: string;
}

/**
 * One-time credential panel. The password only exists in this response —
 * it is stored hashed and can never be displayed again, only regenerated.
 */
export function CredentialReveal({ patientId, password }: CredentialRevealProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        <p className="text-[13px] leading-relaxed text-ink">
          <span className="font-semibold">Shown only once.</span> Copy these credentials and
          hand them to the patient through a channel you trust. If they are lost, regenerate
          a new password — this one cannot be recovered.
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
