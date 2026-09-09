-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "task_status_history" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fromStatusId" TEXT,
    "toStatusId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_approvals" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "stageStatusId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_workflow_transitions" (
    "id" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,
    "requiredPermissionId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_status_history_taskId_idx" ON "task_status_history"("taskId");

-- CreateIndex
CREATE INDEX "task_status_history_fromStatusId_idx" ON "task_status_history"("fromStatusId");

-- CreateIndex
CREATE INDEX "task_status_history_toStatusId_idx" ON "task_status_history"("toStatusId");

-- CreateIndex
CREATE INDEX "task_status_history_changedById_idx" ON "task_status_history"("changedById");

-- CreateIndex
CREATE INDEX "task_status_history_createdAt_idx" ON "task_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "task_approvals_taskId_idx" ON "task_approvals"("taskId");

-- CreateIndex
CREATE INDEX "task_approvals_reviewerId_idx" ON "task_approvals"("reviewerId");

-- CreateIndex
CREATE INDEX "task_approvals_requestedById_idx" ON "task_approvals"("requestedById");

-- CreateIndex
CREATE INDEX "task_approvals_decidedById_idx" ON "task_approvals"("decidedById");

-- CreateIndex
CREATE INDEX "task_approvals_stageStatusId_idx" ON "task_approvals"("stageStatusId");

-- CreateIndex
CREATE INDEX "task_approvals_status_idx" ON "task_approvals"("status");

-- CreateIndex
CREATE INDEX "task_approvals_requestedAt_idx" ON "task_approvals"("requestedAt");

-- CreateIndex
CREATE INDEX "task_workflow_transitions_fromStatusId_idx" ON "task_workflow_transitions"("fromStatusId");

-- CreateIndex
CREATE INDEX "task_workflow_transitions_toStatusId_idx" ON "task_workflow_transitions"("toStatusId");

-- CreateIndex
CREATE INDEX "task_workflow_transitions_requiredPermissionId_idx" ON "task_workflow_transitions"("requiredPermissionId");

-- CreateIndex
CREATE INDEX "task_workflow_transitions_isActive_idx" ON "task_workflow_transitions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "task_workflow_transitions_fromStatusId_toStatusId_key" ON "task_workflow_transitions"("fromStatusId", "toStatusId");

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_status_history" ADD CONSTRAINT "task_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approvals" ADD CONSTRAINT "task_approvals_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approvals" ADD CONSTRAINT "task_approvals_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approvals" ADD CONSTRAINT "task_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approvals" ADD CONSTRAINT "task_approvals_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_approvals" ADD CONSTRAINT "task_approvals_stageStatusId_fkey" FOREIGN KEY ("stageStatusId") REFERENCES "task_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_workflow_transitions" ADD CONSTRAINT "task_workflow_transitions_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "task_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_workflow_transitions" ADD CONSTRAINT "task_workflow_transitions_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "task_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_workflow_transitions" ADD CONSTRAINT "task_workflow_transitions_requiredPermissionId_fkey" FOREIGN KEY ("requiredPermissionId") REFERENCES "permissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
