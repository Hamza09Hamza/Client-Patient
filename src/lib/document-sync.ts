import { db } from "@/lib/db";
import { fetchPatientDocuments } from "@/lib/clinic-source";
import { audit } from "@/lib/audit";
import type { ActorType } from "@prisma/client";

export interface DocumentSyncResult {
  ok: boolean;
  count: number;
  error?: string;
}

/**
 * Pulls a patient's document history from SERVER A and upserts each as a
 * LabResult (no analyte values — the report lives as a PDF, not structured
 * data). Upsert is keyed on [patientDbId, sourceRef], so calling this
 * repeatedly is safe whether SERVER A sends the full history every time or
 * only the newest items — either way nothing is duplicated.
 */
export async function syncPatientDocumentsCore(
  patientDbId: string,
  patientClinicId: string,
  actorType: ActorType,
  actorId: string,
): Promise<DocumentSyncResult> {
  const result = await fetchPatientDocuments(patientClinicId);
  if (!result.ok) {
    return { ok: false, count: 0, error: result.error };
  }

  let count = 0;
  for (const doc of result.documents) {
    if (!doc.externalId || !doc.title || !doc.collectedAt || !doc.link) continue;
    const collectedAt = new Date(doc.collectedAt);
    if (Number.isNaN(collectedAt.getTime())) continue;

    await db.labResult.upsert({
      where: { patientDbId_sourceRef: { patientDbId, sourceRef: doc.externalId } },
      create: {
        // Reuses the same LAB-YYYY-#### numbering as manually entered results
        // so both kinds sort and display identically in the portal.
        reference: `SRC-${doc.externalId}`,
        patientDbId,
        category: doc.category ?? "Clinic report",
        testName: doc.title,
        status: "COMPLETED",
        orderingPhysician: doc.physician ?? null,
        collectedAt,
        reportedAt: collectedAt,
        notes: doc.notes ?? null,
        sourceRef: doc.externalId,
        sourceLink: doc.link,
      },
      update: {
        testName: doc.title,
        category: doc.category ?? "Clinic report",
        orderingPhysician: doc.physician ?? null,
        collectedAt,
        notes: doc.notes ?? null,
        sourceLink: doc.link,
      },
    });
    count++;
  }

  await audit(actorType, actorId, "DOCUMENTS_SYNCED", patientClinicId, `count=${count}`);
  return { ok: true, count };
}
