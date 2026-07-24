-- Patients get a short, separate generated login username (see
-- src/lib/password.ts generateUsername), distinct from the clinic's own
-- patientId. No production patient data exists yet (demo/seed only,
-- verified before writing this migration), so rows are cleared here rather
-- than backfilled -- re-seed after applying this migration.
DELETE FROM "Patient";
ALTER TABLE "Patient" ADD COLUMN "username" TEXT NOT NULL;
CREATE UNIQUE INDEX "Patient_username_key" ON "Patient"("username");
