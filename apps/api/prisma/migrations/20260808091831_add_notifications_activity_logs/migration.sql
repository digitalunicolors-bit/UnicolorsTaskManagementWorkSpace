-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationKind" ADD VALUE 'TASK_REASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_UPCOMING_DEADLINE';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_OVERDUE';
ALTER TYPE "NotificationKind" ADD VALUE 'COMMENT_ADDED';
ALTER TYPE "NotificationKind" ADD VALUE 'USER_MENTIONED';
ALTER TYPE "NotificationKind" ADD VALUE 'FILE_UPLOADED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_SUBMITTED_FOR_REVIEW';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_APPROVED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_CHANGES_REQUESTED';
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_COMPLETED';
ALTER TYPE "NotificationKind" ADD VALUE 'PROJECT_DEADLINE_APPROACHING';

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "redirectPath" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taskAssigned" BOOLEAN NOT NULL DEFAULT true,
    "taskReassigned" BOOLEAN NOT NULL DEFAULT true,
    "dueReminder" BOOLEAN NOT NULL DEFAULT true,
    "upcomingDeadline" BOOLEAN NOT NULL DEFAULT true,
    "overdueTask" BOOLEAN NOT NULL DEFAULT true,
    "commentAdded" BOOLEAN NOT NULL DEFAULT true,
    "userMentioned" BOOLEAN NOT NULL DEFAULT true,
    "fileUploaded" BOOLEAN NOT NULL DEFAULT true,
    "reviewUpdates" BOOLEAN NOT NULL DEFAULT true,
    "taskCompleted" BOOLEAN NOT NULL DEFAULT true,
    "projectDeadline" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_actorId_idx" ON "notifications"("actorId");

-- CreateIndex
CREATE INDEX "notifications_kind_idx" ON "notifications"("kind");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_entityType_entityId_idx" ON "notifications"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_userId_idx" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_idx" ON "activity_logs"("entityType");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
