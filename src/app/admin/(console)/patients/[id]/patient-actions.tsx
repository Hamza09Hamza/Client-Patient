"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, Pencil, ShieldOff, ShieldCheck } from "lucide-react";
import {
  regeneratePatientPassword,
  togglePatientStatus,
  updatePatient,
  type AdminActionState,
} from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { CredentialReveal } from "@/components/admin/credential-reveal";

interface PatientData {
  id: string;
  patientId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null; // yyyy-mm-dd
  gender: string | null;
  active: boolean;
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

export function EditPatientButton({ patient }: { patient: PatientData }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(updatePatient, {});

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden className="size-4" />
        Edit details
      </Button>
      <Modal open={open} onClose={close} title={`Edit ${patient.fullName}`}>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={patient.id} />
          <ErrorNote message={state.error} />
          {state.ok && (
            <p role="status" className="rounded-xl border border-accent/25 bg-accent-soft px-3.5 py-3 text-sm font-medium text-accent-strong">
              Details saved.
            </p>
          )}
          <Field label="Full name" name="fullName" defaultValue={patient.fullName} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" defaultValue={patient.email ?? ""} />
            <Field label="Phone" name="phone" type="tel" defaultValue={patient.phone ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              defaultValue={patient.dateOfBirth ?? ""}
            />
            <SelectField label="Gender" name="gender" defaultValue={patient.gender ?? ""}>
              <option value="">Not specified</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </SelectField>
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <Button type="button" variant="ghost" onClick={close}>
              Close
            </Button>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function RegeneratePasswordButton({ patient }: { patient: PatientData }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    regeneratePatientPassword,
    {},
  );

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden className="size-4" />
        Regenerate password
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={state.ok && state.password ? "New credentials ready" : "Regenerate password?"}
      >
        {state.ok && state.password && state.patientId ? (
          <div className="space-y-5">
            <CredentialReveal patientId={state.patientId} password={state.password} />
            <Button onClick={close} variant="secondary" className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-5">
            <input type="hidden" name="id" value={patient.id} />
            <ErrorNote message={state.error} />
            <p className="text-sm leading-relaxed text-ink-muted">
              This creates a new password for{" "}
              <span className="font-semibold text-ink">{patient.fullName}</span> and
              immediately invalidates the current one. The patient will need the new
              password for their next sign-in.
            </p>
            <div className="flex justify-end gap-2.5">
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                <KeyRound aria-hidden className="size-4" />
                Generate new password
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ToggleStatusButton({ patient }: { patient: PatientData }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    togglePatientStatus,
    {},
  );

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  return (
    <>
      <Button variant={patient.active ? "danger" : "accent"} onClick={() => setOpen(true)}>
        {patient.active ? (
          <ShieldOff aria-hidden className="size-4" />
        ) : (
          <ShieldCheck aria-hidden className="size-4" />
        )}
        {patient.active ? "Disable access" : "Enable access"}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={patient.active ? "Disable this account?" : "Enable this account?"}
      >
        <form action={action} className="space-y-5">
          <input type="hidden" name="id" value={patient.id} />
          <ErrorNote message={state.error} />
          <p className="text-sm leading-relaxed text-ink-muted">
            {patient.active ? (
              <>
                <span className="font-semibold text-ink">{patient.fullName}</span> will no
                longer be able to sign in or view results. Their data stays intact and you
                can re-enable access at any time.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{patient.fullName}</span> will be
                able to sign in again with their existing credentials.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant={patient.active ? "danger" : "accent"} loading={pending}>
              {patient.active ? "Disable account" : "Enable account"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
