-- DropForeignKey
ALTER TABLE "PasswordResetRequest" DROP CONSTRAINT "PasswordResetRequest_patientDbId_fkey";

-- DropTable
DROP TABLE "PasswordResetRequest";

-- DropEnum
DROP TYPE "ResetRequestStatus";

