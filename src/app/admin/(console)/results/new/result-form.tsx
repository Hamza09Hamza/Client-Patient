"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, FilePlus2, Plus, Trash2 } from "lucide-react";
import { createResult, type AdminActionState } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, TextareaField } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface PatientOption {
  id: string;
  patientId: string;
  fullName: string;
}

const CATEGORY_SUGGESTIONS = [
  "Hematology",
  "Biochemistry",
  "Endocrinology",
  "Immunology",
  "Microbiology",
  "Serology",
  "Urinalysis",
];

interface ValueRow {
  key: number;
}

export function ResultForm({ patients }: { patients: PatientOption[] }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(createResult, {});
  const [rows, setRows] = useState<ValueRow[]>([{ key: 0 }]);
  const [nextKey, setNextKey] = useState(1);

  function addRow() {
    setRows((r) => [...r, { key: nextKey }]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));
  }

  if (state.ok) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 aria-hidden className="mx-auto mb-3 size-10 text-accent-strong" />
        <h2 className="text-lg font-semibold text-ink">Report {state.patientId} recorded</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
          The patient can see it in their portal immediately.
        </p>
        <div className="mt-6 flex justify-center gap-2.5">
          <Link
            href="/admin/results/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-strong active:scale-[0.98]"
          >
            <FilePlus2 aria-hidden className="size-4" />
            Record another
          </Link>
          <Link
            href="/admin/results"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-sm font-medium text-primary-deep transition-all duration-200 hover:bg-primary-wash"
          >
            Back to results
          </Link>
        </div>
      </Card>
    );
  }

  const inputSm =
    "h-10 w-full rounded-lg border border-border-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

  return (
    <form action={action} className="space-y-6" noValidate>
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold text-ink">Order details</h2>
        <SelectField label="Patient" name="patientDbId" required defaultValue="">
          <option value="" disabled>
            Choose a patient…
          </option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} — {p.patientId}
            </option>
          ))}
        </SelectField>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field label="Category" name="category" list="category-suggestions" required />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <Field label="Test name" name="testName" placeholder="e.g. Complete Blood Count (CBC)" required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Specimen" name="specimen" placeholder="e.g. Serum" />
          <Field label="Ordering physician" name="orderingPhysician" placeholder="e.g. Dr. S. Haddad" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collected at" name="collectedAt" type="datetime-local" required />
          <SelectField label="Status" name="status" defaultValue="COMPLETED">
            <option value="PENDING">In progress (no values yet)</option>
            <option value="COMPLETED">Completed</option>
            <option value="REVIEWED">Reviewed</option>
          </SelectField>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-ink">Analyte values</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Leave empty when the analysis is still in progress.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addRow}>
            <Plus aria-hidden className="size-3.5" />
            Add row
          </Button>
        </div>

        <div className="space-y-3">
          {rows.map((row, i) => (
            <fieldset
              key={row.key}
              className="grid grid-cols-2 items-end gap-2.5 rounded-xl border border-border p-3 sm:grid-cols-[1fr_90px_90px_120px_110px_40px]"
            >
              <legend className="sr-only">Analyte row {i + 1}</legend>
              <div className="col-span-2 sm:col-span-1">
                <label className="mb-1 block text-[12px] font-medium text-ink-muted" htmlFor={`analyte-${row.key}`}>
                  Analyte
                </label>
                <input
                  id={`analyte-${row.key}`}
                  name={`values[${i}][analyte]`}
                  placeholder="e.g. Hemoglobin"
                  className={inputSm}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-muted" htmlFor={`value-${row.key}`}>
                  Value
                </label>
                <input
                  id={`value-${row.key}`}
                  name={`values[${i}][value]`}
                  placeholder="14.2"
                  className={`${inputSm} tnum`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-muted" htmlFor={`unit-${row.key}`}>
                  Unit
                </label>
                <input
                  id={`unit-${row.key}`}
                  name={`values[${i}][unit]`}
                  placeholder="g/dL"
                  className={inputSm}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-muted" htmlFor={`range-${row.key}`}>
                  Ref. range
                </label>
                <input
                  id={`range-${row.key}`}
                  name={`values[${i}][refRange]`}
                  placeholder="13.0 – 17.0"
                  className={`${inputSm} tnum`}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-muted" htmlFor={`flag-${row.key}`}>
                  Flag
                </label>
                <select id={`flag-${row.key}`} name={`values[${i}][flag]`} className={inputSm} defaultValue="NORMAL">
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                aria-label={`Remove analyte row ${i + 1}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-30"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </fieldset>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <TextareaField
          label="Laboratory notes"
          name="notes"
          placeholder="Optional remarks that will appear on the report."
        />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={pending}>
          <FilePlus2 aria-hidden className="size-4" />
          Record report
        </Button>
      </div>
    </form>
  );
}
