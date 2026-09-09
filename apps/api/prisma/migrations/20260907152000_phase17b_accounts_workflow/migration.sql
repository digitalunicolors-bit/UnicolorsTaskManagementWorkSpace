-- Phase 17B: Accounts & Quotation workflow on approved clients
CREATE TYPE "ClientAccountsStage" AS ENUM (
  'NEW_HANDOVER',
  'QUOTATION_PREPARED',
  'AWAITING_CLIENT_CONFIRMATION',
  'READY_FOR_CLIENT_SERVICING',
  'HANDED_TO_CLIENT_SERVICING'
);

ALTER TABLE "clients"
  ADD COLUMN "accountsStage" "ClientAccountsStage",
  ADD COLUMN "quotationNumber" TEXT,
  ADD COLUMN "quotationAmount" DOUBLE PRECISION,
  ADD COLUMN "quotationDetails" TEXT,
  ADD COLUMN "billingDetails" TEXT,
  ADD COLUMN "quotationPreparedAt" TIMESTAMP(3),
  ADD COLUMN "quotationSentAt" TIMESTAMP(3),
  ADD COLUMN "clientCommercialConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "clientServicingHandoverAt" TIMESTAMP(3);

UPDATE "clients"
SET "accountsStage" = 'NEW_HANDOVER'
WHERE "accountsHandoverAt" IS NOT NULL
  AND "onboardingStage" = 'APPROVED'
  AND "deletedAt" IS NULL;

CREATE INDEX "clients_accountsStage_idx" ON "clients"("accountsStage");
