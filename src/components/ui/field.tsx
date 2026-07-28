"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

const INPUT_CLASSES =
  "w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-primary focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-50";

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, id: idProp, className, required, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </label>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT_CLASSES} h-11 ${error ? "border-danger" : "border-border-strong"}`}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});

type PasswordFieldProps = Omit<FieldProps, "type"> & {
  showPasswordLabel: string;
  hidePasswordLabel: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      error,
      hint,
      showPasswordLabel,
      hidePasswordLabel,
      id: idProp,
      className,
      required,
      ...props
    },
    ref,
  ) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const [visible, setVisible] = useState(false);
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${INPUT_CLASSES} h-11 pr-11 ${error ? "border-danger" : "border-border-strong"}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? hidePasswordLabel : showPasswordLabel}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-faint transition-colors hover:text-primary"
          >
            {visible ? <EyeOff aria-hidden className="size-4.5" /> : <Eye aria-hidden className="size-4.5" />}
          </button>
        </div>
        {hint && !error && (
          <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  function TextareaField({ label, error, hint, id: idProp, className, required, ...props }, ref) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
    return (
      <div className={className}>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
          {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
        </label>
        <textarea
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${INPUT_CLASSES} min-h-24 py-2.5 ${error ? "border-danger" : "border-border-strong"}`}
          {...props}
        />
        {hint && !error && (
          <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
