"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectField } from "@/components/ui/select";

export function AuditFilter() {
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
      <option value="">All actors</option>
      <option value="ADMIN">Admins</option>
      <option value="PATIENT">Patients</option>
      <option value="SYSTEM">System</option>
    </SelectField>
  );
}
