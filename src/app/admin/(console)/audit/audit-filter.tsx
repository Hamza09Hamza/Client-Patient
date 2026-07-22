"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectField } from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AuditFilter({ dict }: { dict: Dictionary["adminAudit"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <SelectField
      label="Filter by actor type"
      hideLabel
      className="sm:w-56"
      value={searchParams.get("actor") ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("actor", e.target.value);
        else params.delete("actor");
        params.delete("page");
        startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
      }}
    >
      <option value="">{dict.allActors}</option>
      <option value="ADMIN">{dict.admins}</option>
      <option value="PATIENT">{dict.patients}</option>
      <option value="SYSTEM">{dict.system}</option>
    </SelectField>
  );
}
