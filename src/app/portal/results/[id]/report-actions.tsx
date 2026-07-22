"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReportActions({
  resultId,
  printLabel,
  downloadLabel,
}: {
  resultId: string;
  printLabel: string;
  downloadLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer aria-hidden className="size-4" />
        {printLabel}
      </Button>
      <a
        href={`/portal/results/${resultId}/pdf`}
        download
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 select-none hover:bg-primary-strong active:scale-[0.98]"
      >
        <Download aria-hidden className="size-4" />
        {downloadLabel}
      </a>
    </div>
  );
}
