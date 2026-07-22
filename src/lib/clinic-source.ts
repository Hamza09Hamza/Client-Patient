import { SignJWT } from "jose";

/**
 * Outbound client to the clinic's own system ("SERVER A"). We (SERVER B)
 * provision the patient and generate their portal password locally, then call
 * out to A — presenting a short-lived signed token — to pull that patient's
 * full document history (PDF report metadata) and cache it locally.
 *
 * This file is the one integration point to adjust if SERVER A's actual
 * endpoint path or response shape differs from what's documented below and
 * in docs/API.md — everything else in the app is decoupled from it.
 */

export interface ClinicDocument {
  /** SERVER A's own id for this document — used for idempotent re-sync */
  externalId: string;
  title: string;
  category?: string;
  collectedAt: string; // ISO date or datetime
  /** Raw link/path as SERVER A stores it — may be a URL or a local path (e.g. "C:\Reports\..."). Stored as-is; see README security note. */
  link: string;
  physician?: string;
  notes?: string;
}

export interface ClinicSourceResult {
  ok: true;
  documents: ClinicDocument[];
}

export interface ClinicSourceError {
  ok: false;
  error: string;
}

function isConfigured(): boolean {
  return Boolean(process.env.CLINIC_SOURCE_BASE_URL && process.env.CLINIC_SOURCE_SHARED_SECRET);
}

/** Short-lived token proving to SERVER A that this request really comes from us, for this patient. */
async function mintSourceToken(patientId: string): Promise<string> {
  const secret = process.env.CLINIC_SOURCE_SHARED_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLINIC_SOURCE_SHARED_SECRET must be set to a random string of at least 32 characters");
  }
  return new SignJWT({ patientId, purpose: "document-sync" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(secret));
}

/**
 * Calls SERVER A for a patient's document history.
 * Expected contract (SERVER A's side — see docs/API.md "Clinic source contract"):
 *
 *   POST {CLINIC_SOURCE_BASE_URL}/patients/{patientId}/documents
 *   Body: { patientId, token }
 *   Response 200: { documents: ClinicDocument[] }
 */
export async function fetchPatientDocuments(
  patientId: string,
): Promise<ClinicSourceResult | ClinicSourceError> {
  if (!isConfigured()) {
    return { ok: false, error: "Clinic source integration is not configured (CLINIC_SOURCE_BASE_URL / CLINIC_SOURCE_SHARED_SECRET)." };
  }

  const baseUrl = process.env.CLINIC_SOURCE_BASE_URL!.replace(/\/$/, "");
  const token = await mintSourceToken(patientId);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/patients/${encodeURIComponent(patientId)}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, token }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { ok: false, error: `Could not reach the clinic system: ${(err as Error).message}` };
  }

  if (!response.ok) {
    return { ok: false, error: `Clinic system returned ${response.status}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "Clinic system returned an invalid response." };
  }

  const documents = (body as { documents?: unknown }).documents;
  if (!Array.isArray(documents)) {
    return { ok: false, error: "Clinic system response is missing a documents array." };
  }

  return { ok: true, documents: documents as ClinicDocument[] };
}
