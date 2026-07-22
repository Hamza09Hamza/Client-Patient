import { db } from "@/lib/db";
import type { ActorType } from "@prisma/client";

export async function audit(
  actorType: ActorType,
  actorId: string,
  action: string,
  target?: string,
  detail?: string,
): Promise<void> {
  try {
    await db.auditLog.create({ data: { actorType, actorId, action, target, detail } });
  } catch (err) {
    // Auditing must never break the main flow.
    console.error("audit log write failed", err);
  }
}
