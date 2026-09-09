CREATE TYPE "ClientOnboardingStage" AS ENUM (
  'DRAFT',
  'TERMS_SHARED',
  'AWAITING_CLIENT_APPROVAL',
  'APPROVED',
  'REJECTED',
  'FOLLOW_UP'
);

ALTER TABLE "clients"
  ADD COLUMN "onboardingStage" "ClientOnboardingStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "requirements" TEXT,
  ADD COLUMN "termsConditions" TEXT,
  ADD COLUMN "termsSharedAt" TIMESTAMP(3),
  ADD COLUMN "clientApprovalAt" TIMESTAMP(3),
  ADD COLUMN "clientApprovalNote" TEXT,
  ADD COLUMN "accountsHandoverAt" TIMESTAMP(3);

-- Preserve the meaning of existing client records when the onboarding
-- workflow is introduced. Existing active/completed clients are treated as
-- already approved; paused/inactive clients are treated as follow-up.
UPDATE "clients"
SET
  "onboardingStage" = 'APPROVED',
  "clientApprovalAt" = COALESCE("updatedAt", "createdAt"),
  "accountsHandoverAt" = COALESCE("updatedAt", "createdAt")
WHERE "status" IN ('ACTIVE', 'COMPLETED');

UPDATE "clients"
SET "onboardingStage" = 'FOLLOW_UP'
WHERE "status" IN ('ON_HOLD', 'INACTIVE');

CREATE INDEX "clients_onboardingStage_idx"
  ON "clients"("onboardingStage");
