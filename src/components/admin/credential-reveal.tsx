import { ShieldAlert } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface CredentialRevealProps {
  patientId: string;
  password: string;
  /** "generated" for a brand-new password, "viewed" for recalling the existing one */
  mode?: "generated" | "viewed";
  dict: Dictionary["credentials"];
}

/**
 * Credential panel shown after generating or viewing a patient's password.
 * Every view is written to the audit log — see viewPatientPassword().
 */
export function CredentialReveal({ patientId, password, mode = "generated", dict }: CredentialRevealProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        <p className="text-[13px] leading-relaxed text-ink">
          <span className="font-semibold">
            {mode === "generated" ? dict.generatedNotice : dict.viewedNotice}
          </span>{" "}
          {mode === "generated" ? dict.generatedNoticeDetail : dict.viewedNoticeDetail}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-canvas p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {dict.patientId}
            </p>
            <p className="tnum truncate font-semibold text-ink">{patientId}</p>
          </div>
          <CopyButton value={patientId} label={dict.copy} copiedLabel={dict.copied} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {dict.password}
            </p>
            <p className="tnum truncate font-mono text-[15px] font-semibold text-primary-deep">
              {password}
            </p>
          </div>
          <CopyButton value={password} label={dict.copy} copiedLabel={dict.copied} />
        </div>
        <div className="border-t border-border pt-3">
          <CopyButton
            value={`${dict.portalAccessLabel}\n${dict.patientId}: ${patientId}\n${dict.password}: ${password}`}
            label={dict.copyBoth}
            copiedLabel={dict.copied}
          />
        </div>
      </div>
    </div>
  );
}
