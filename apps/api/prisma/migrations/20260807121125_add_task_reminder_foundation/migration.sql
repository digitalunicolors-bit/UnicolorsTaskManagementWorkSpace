-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('DAILY_MORNING', 'ON_DUE_DATE', 'BEFORE_DUE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('TASK_DAILY_DIGEST', 'TASK_DUE_REMINDER', 'TASK_BEFORE_DUE', 'TASK_CUSTOM_REMINDER', 'TASK_ASSIGNED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "whatsappOptInAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "task_reminders" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "minutesBeforeDue" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_reminders_taskId_idx" ON "task_reminders"("taskId");

-- CreateIndex
CREATE INDEX "task_reminders_type_idx" ON "task_reminders"("type");

-- CreateIndex
CREATE INDEX "task_reminders_channel_idx" ON "task_reminders"("channel");

-- CreateIndex
CREATE INDEX "task_reminders_scheduledAt_idx" ON "task_reminders"("scheduledAt");

-- CreateIndex
CREATE INDEX "task_reminders_isActive_idx" ON "task_reminders"("isActive");

-- CreateIndex
CREATE INDEX "task_reminders_deletedAt_idx" ON "task_reminders"("deletedAt");

-- CreateIndex
CREATE INDEX "notification_deliveries_userId_idx" ON "notification_deliveries"("userId");

-- CreateIndex
CREATE INDEX "notification_deliveries_kind_idx" ON "notification_deliveries"("kind");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_idx" ON "notification_deliveries"("channel");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");

-- CreateIndex
CREATE INDEX "notification_deliveries_createdAt_idx" ON "notification_deliveries"("createdAt");

-- CreateIndex
CREATE INDEX "users_phoneVerifiedAt_idx" ON "users"("phoneVerifiedAt");

-- CreateIndex
CREATE INDEX "users_whatsappOptInAt_idx" ON "users"("whatsappOptInAt");

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
