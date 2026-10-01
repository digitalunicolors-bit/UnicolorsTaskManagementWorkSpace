ALTER TABLE "clients"
  ADD COLUMN "scopeCommitments" JSONB,
  ADD COLUMN "paymentRemark" TEXT,
  ADD COLUMN "quotationApprovedAt" TIMESTAMP(3),
  ADD COLUMN "quotationApprovedById" TEXT,
  ADD COLUMN "quotationApprovalNote" TEXT;

ALTER TABLE "projects"
  ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false;
