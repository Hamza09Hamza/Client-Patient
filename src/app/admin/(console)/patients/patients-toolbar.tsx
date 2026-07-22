"use client";

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Search, UserPlus } from "lucide-react";
import { createPatient, type AdminActionState } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { CredentialReveal } from "@/components/admin/credential-reveal";

export function PatientsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(searchParams.get("new") === "1");

  const [state, action, submitting] = useActionState<AdminActionState, FormData>(
    createPatient,
    {},
  );

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page");
      params.delete("new");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    debounceRef.current = setTimeout(() => setParams({ q: search }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchParams, setParams]);

  function closeModal() {
    setOpen(false);
    if (searchParams.get("new")) setParams({});
    // refresh the table if a patient was created while the modal was open
    if (state.ok) router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or patient ID"
            aria-label="Search patients"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-10 text-[15px] text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
          {isPending && (
            <Loader2
              aria-hidden
              className="absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2 animate-spin text-primary"
            />
          )}
        </div>

        <SelectField
          label="Status filter"
          hideLabel
          className="sm:w-44"
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setParams({ status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DISABLED">Disabled</option>
        </SelectField>

        <Button onClick={() => setOpen(true)}>
          <UserPlus aria-hidden className="size-4" />
          New patient
        </Button>
      </div>

      <Modal
        open={open}
        onClose={closeModal}
        title={state.ok && state.password ? "Patient created" : "Register a new patient"}
      >
        {state.ok && state.password && state.patientId ? (
          <div className="space-y-5">
            <CredentialReveal patientId={state.patientId} password={state.password} />
            <Button onClick={closeModal} variant="secondary" className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-4" noValidate>
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
              label="Patient ID"
              name="patientId"
              placeholder="e.g. PAT-2026-0006"
              autoCapitalize="none"
              spellCheck={false}
              required
              hint="The identifier from the clinic system — it becomes the patient's username."
            />
            <Field label="Full name" name="fullName" required autoComplete="off" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" name="email" type="email" autoComplete="off" />
              <Field label="Phone" name="phone" type="tel" autoComplete="off" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth" name="dateOfBirth" type="date" />
              <SelectField label="Gender" name="gender" defaultValue="">
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </SelectField>
            </div>

            <p className="text-[13px] leading-relaxed text-ink-muted">
              A strong password is generated automatically when you save — you will see it
              once, on the next screen.
            </p>

            <Button type="submit" loading={submitting} className="w-full">
              <UserPlus aria-hidden className="size-4" />
              Create patient and generate password
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
