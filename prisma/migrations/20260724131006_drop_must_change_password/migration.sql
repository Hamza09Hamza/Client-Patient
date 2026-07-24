-- mustChangePassword was written on every (re)generation but never read or
-- enforced anywhere -- there is no self-service password-change flow for it
-- to gate (see AGENTS.md / README "No online password reset"). Dead column.
ALTER TABLE "Patient" DROP COLUMN "mustChangePassword";
