-- DropForeignKey
ALTER TABLE "LabResultValue" DROP CONSTRAINT "LabResultValue_resultId_fkey";

-- DropTable
DROP TABLE "LabResultValue";

-- DropEnum
DROP TYPE "ValueFlag";
