-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurringTaskId" TEXT;

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'STOPPED',
    "workDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "activeStartedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_tasks" (
    "id" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "dayOfMonth" INTEGER,
    "recurrenceRule" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "recurring_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entries_employeeId_idx" ON "time_entries"("employeeId");

-- CreateIndex
CREATE INDEX "time_entries_projectId_idx" ON "time_entries"("projectId");

-- CreateIndex
CREATE INDEX "time_entries_taskId_idx" ON "time_entries"("taskId");

-- CreateIndex
CREATE INDEX "time_entries_status_idx" ON "time_entries"("status");

-- CreateIndex
CREATE INDEX "time_entries_workDate_idx" ON "time_entries"("workDate");

-- CreateIndex
CREATE INDEX "time_entries_createdAt_idx" ON "time_entries"("createdAt");

-- CreateIndex
CREATE INDEX "time_entries_deletedAt_idx" ON "time_entries"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_tasks_templateTaskId_key" ON "recurring_tasks"("templateTaskId");

-- CreateIndex
CREATE INDEX "recurring_tasks_createdById_idx" ON "recurring_tasks"("createdById");

-- CreateIndex
CREATE INDEX "recurring_tasks_frequency_idx" ON "recurring_tasks"("frequency");

-- CreateIndex
CREATE INDEX "recurring_tasks_nextRunAt_idx" ON "recurring_tasks"("nextRunAt");

-- CreateIndex
CREATE INDEX "recurring_tasks_isActive_idx" ON "recurring_tasks"("isActive");

-- CreateIndex
CREATE INDEX "recurring_tasks_deletedAt_idx" ON "recurring_tasks"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_recurringTaskId_idx" ON "tasks"("recurringTaskId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurringTaskId_fkey" FOREIGN KEY ("recurringTaskId") REFERENCES "recurring_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
