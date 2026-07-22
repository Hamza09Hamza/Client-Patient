"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Mail, X } from "lucide-react";
import {
  approveResetRequest,
  denyResetRequest,
  type AdminActionState,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { CredentialReveal } from "@/components/admin/credential-reveal";
import { CLINIC_NAME } from "@/lib/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface RequestSummary {
  id: string;
  submittedPatientId: string;
  email: string;
  patientName: string | null;
}

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  );
}

export function ApproveRequestButton({ request, dict }: { request: RequestSummary; dict: Dictionary }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    approveResetRequest,
    {},
  );
  const t = dict.adminRequests;

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  const mailto =
    state.password && state.patientId
      ? `mailto:${request.email}?subject=${encodeURIComponent("Your new clinic portal password")}&body=${encodeURIComponent(
          `Hello,\n\nYour password reset request has been approved.\n\nPatient ID: ${state.patientId}\nNew password: ${state.password}\n\nSign in at the patient portal and consider changing this password in Settings.\n\n${CLINIC_NAME}`,
        )}`
      : null;

  return (
    <>
      <Button variant="accent" size="sm" onClick={() => setOpen(true)} disabled={!request.patientName}>
        <Check aria-hidden className="size-4" />
        {t.approve}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={state.ok && state.password ? "Reset approved" : "Approve this reset?"}
      >
        {state.ok && state.password && state.patientId ? (
          <div className="space-y-5">
            <CredentialReveal patientId={state.patientId} password={state.password} dict={dict.credentials} />
            {mailto && (
              <a
                href={mailto}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-strong active:scale-[0.98]"
              >
                <Mail aria-hidden className="size-4" />
                Email the credentials to {request.email}
              </a>
            )}
            <Button onClick={close} variant="secondary" className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-5">
            <input type="hidden" name="id" value={request.id} />
            <ErrorNote message={state.error} />
            <p className="text-sm leading-relaxed text-ink-muted">
              A new password will be generated for{" "}
              <span className="font-semibold text-ink">
                {request.patientName ?? request.submittedPatientId}
              </span>{" "}
              and the current one stops working immediately. Make sure the ID document
              matches the patient before approving.
            </p>
            <div className="flex justify-end gap-2.5">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" loading={pending}>
                <Check aria-hidden className="size-4" />
                Approve and generate
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function DenyRequestButton({ request, dict }: { request: RequestSummary; dict: Dictionary["adminRequests"] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    denyResetRequest,
    {},
  );

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <X aria-hidden className="size-4" />
        {dict.deny}
      </Button>
      <Modal open={open} onClose={close} title="Deny this request?">
        <form action={action} className="space-y-5" noValidate>
          <input type="hidden" name="id" value={request.id} />
          <ErrorNote message={state.error} />
          <p className="text-sm leading-relaxed text-ink-muted">
            The request from{" "}
            <span className="font-semibold text-ink">{request.submittedPatientId}</span> will
            be closed without changing any password.
          </p>
          <TextareaField
            label="Reason (kept in the review history)"
            name="reviewNote"
            placeholder="e.g. ID document does not match the patient on file."
          />
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              <X aria-hidden className="size-4" />
              Deny request
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
