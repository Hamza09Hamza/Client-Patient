-- Server A's external document ids are idempotent within a patient, not
-- globally across every patient. The existing (patientDbId, sourceRef)
-- unique index is the authoritative identity for an integrated report.
DROP INDEX "LabResult_reference_key";
CREATE INDEX "LabResult_reference_idx" ON "LabResult"("reference");
