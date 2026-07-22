"use client";

import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** visually hide the label (still read by screen readers) — for filter bars */
  hideLabel?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hideLabel, id: idProp, className, children, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-medium text-ink"}
      >
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          className="h-11 w-full appearance-none rounded-xl border border-border-strong bg-surface pl-3.5 pr-9 text-[15px] text-ink transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
        />
      </div>
    </div>
  );
});
