import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { FadeIn } from "@/components/rb/fade-in";
import { ResultForm } from "./result-form";

export const metadata: Metadata = { title: "Record a result" };

export default async function NewResultPage() {
  await requireAdmin();
  const patients = await db.patient.findMany({
    where: { status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, patientId: true, fullName: true },
  });

  return (
    <div className="space-y-6">
      <FadeIn>
        <Link
          href="/admin/results"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All results
        </Link>
        <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
          Record a laboratory result
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          A report number is assigned automatically and the report becomes visible to the
          patient as soon as it is saved.
        </p>
      </FadeIn>

      <FadeIn delay={0.1}>
        <ResultForm patients={patients} />
      </FadeIn>
    </div>
  );
}
