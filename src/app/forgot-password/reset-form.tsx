"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, ImagePlus, Send, X } from "lucide-react";
import { submitResetRequest, type ResetRequestState } from "./actions";
import { Field, TextareaField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/rb/fade-in";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ResetRequestForm({ dict }: { dict: Dictionary["forgotPassword"] }) {
  const [state, action, pending] = useActionState<ResetRequestState, FormData>(
    submitResetRequest,
    {},
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (state.ok) {
    return (
      <FadeIn>
        <div className="rounded-2xl border border-accent/25 bg-accent-soft p-6 text-center">
          <CheckCircle2 aria-hidden className="mx-auto mb-3 size-10 text-accent-strong" />
          <h2 className="text-lg font-semibold text-ink">{dict.successTitle}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            {dict.successText}
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {dict.backToSignIn}
          </Link>
        </div>
      </FadeIn>
    );
  }

  function onFileChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      setFileName(null);
      setPreview(null);
      return;
    }
    setFileName(file.name);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  function clearFile() {
    if (fileInput.current) fileInput.current.value = "";
    onFileChange(null);
  }

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

      <Field
        label={dict.patientIdLabel}
        name="patientId"
        placeholder="e.g. PAT-2026-0001"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
      />

      <Field
        label={dict.emailLabel}
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
        hint={dict.emailHint}
      />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink">
          {dict.photoLabel}
          <span aria-hidden className="ml-0.5 text-danger">*</span>
        </span>
        <input
          ref={fileInput}
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => onFileChange(e.target.files)}
        />
        {fileName ? (
          <div className="flex items-center gap-3 rounded-xl border border-border-strong bg-surface p-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview of the selected ID document"
                className="size-14 rounded-lg border border-border object-cover"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{fileName}</span>
            <button
              type="button"
              onClick={clearFile}
              aria-label={dict.removePhoto}
              className="flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-canvas hover:text-danger"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="photo"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-surface px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-wash"
          >
            <ImagePlus aria-hidden className="size-6 text-primary" />
            <span className="text-sm font-medium text-ink">{dict.photoDropTitle}</span>
            <span className="text-xs text-ink-muted">{dict.photoDropHint}</span>
          </label>
        )}
        <p className="mt-1.5 text-[13px] text-ink-muted">{dict.photoHint}</p>
      </div>

      <TextareaField label={dict.noteLabel} name="note" placeholder={dict.notePlaceholder} required />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {dict.submitButton}
        {!pending && <Send aria-hidden className="size-4" />}
      </Button>
    </form>
  );
}
