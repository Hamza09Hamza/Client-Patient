-- The admin console is removed entirely: this app is now patient-portal +
-- integration-API only, patient/report management happens exclusively via
-- the clinic's own system (SERVER A) pushing through the integration API.
DELETE FROM "AuditLog" WHERE "actorType" = 'ADMIN';
DROP TABLE "Admin";

-- Postgres enums can't drop a value in place; rebuild the type.
ALTER TYPE "ActorType" RENAME TO "ActorType_old";
CREATE TYPE "ActorType" AS ENUM ('PATIENT', 'SYSTEM');
ALTER TABLE "AuditLog" ALTER COLUMN "actorType" TYPE "ActorType" USING ("actorType"::text::"ActorType");
DROP TYPE "ActorType_old";

-- Patient passwords move from plaintext to a scrypt hash (see
-- src/lib/password.ts). No production patient data exists yet (demo/seed
-- only, verified before writing this migration), so rows are cleared here
-- rather than migrated in place -- re-seed after applying this migration.
DELETE FROM "Patient";
ALTER TABLE "Patient" DROP COLUMN "password";
ALTER TABLE "Patient" ADD COLUMN "passwordHash" TEXT NOT NULL;
