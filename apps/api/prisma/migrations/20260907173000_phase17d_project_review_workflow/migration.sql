CREATE TYPE "ProjectReviewStage" AS ENUM ('CLIENT_SERVICING_REVIEW', 'CLIENT_REVIEW', 'CHANGES_REQUIRED', 'COMPLETED');

ALTER TABLE "projects"
ADD COLUMN "reviewStage" "ProjectReviewStage",
ADD COLUMN "clientReviewSentAt" TIMESTAMP(3),
ADD COLUMN "clientApprovedAt" TIMESTAMP(3),
ADD COLUMN "clientFeedback" TEXT,
ADD COLUMN "clientFeedbackAt" TIMESTAMP(3),
ADD COLUMN "clientFeedbackDepartmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
