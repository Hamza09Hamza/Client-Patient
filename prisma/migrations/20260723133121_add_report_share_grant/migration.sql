-- CreateTable
CREATE TABLE "ReportShareGrant" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "labResultId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "ReportShareGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportShareGrant_publicId_key" ON "ReportShareGrant"("publicId");

-- CreateIndex
CREATE INDEX "ReportShareGrant_labResultId_idx" ON "ReportShareGrant"("labResultId");

-- AddForeignKey
ALTER TABLE "ReportShareGrant" ADD CONSTRAINT "ReportShareGrant_labResultId_fkey" FOREIGN KEY ("labResultId") REFERENCES "LabResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

