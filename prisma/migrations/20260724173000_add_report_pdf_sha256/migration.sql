-- Integrated reports are immutable. The content hash lets Server B distinguish
-- an identical network retry from accidental reuse of an externalId for a
-- different PDF. Existing rows are nullable and are backfilled lazily when
-- their next retry is received.
ALTER TABLE "LabResult" ADD COLUMN "pdfSha256" TEXT;
