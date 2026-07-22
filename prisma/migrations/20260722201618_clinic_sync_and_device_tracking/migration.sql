-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginDevice" TEXT;

-- AlterTable
ALTER TABLE "LabResult" ADD COLUMN     "sourceLink" TEXT,
ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "lastLoginDevice" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_patientDbId_sourceRef_key" ON "LabResult"("patientDbId", "sourceRef");

