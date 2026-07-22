"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2 } from "lucide-react";
import { deleteResult, type AdminActionState } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function DeleteResultButton({
  resultId,
  reference,
  patientName,
}: {
  resultId: string;
  reference: string;
  patientName: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(deleteResult, {});

  function close() {
    setOpen(false);
    if (state.ok) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete report ${reference}`}
        className="flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 aria-hidden className="size-4" />
      </button>
      <Modal open={open} onClose={close} title="Delete this report?">
        <form action={action} className="space-y-5">
          <input type="hidden" name="id" value={resultId} />
          {state.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger"
            >
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {state.error}
            </div>
          )}
          <p className="text-sm leading-relaxed text-ink-muted">
            Report <span className="font-semibold text-ink">{reference}</span> for{" "}
            <span className="font-semibold text-ink">{patientName}</span> and all of its
            values will be permanently removed. The patient will no longer see it in their
            portal. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              <Trash2 aria-hidden className="size-4" />
              Delete report
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
