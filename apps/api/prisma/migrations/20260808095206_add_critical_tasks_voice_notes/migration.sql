-- CreateEnum
CREATE TYPE "TaskCreationSource" AS ENUM ('STANDARD', 'CRITICAL_BUTTON');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'TASK_CRITICAL_ASSIGNED';

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "creationSource" "TaskCreationSource" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "task_voice_notes" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "durationSeconds" INTEGER,
    "transcript" TEXT,
    "transcriptEditedAt" TIMESTAMP(3),
    "transcriptionStatus" "TranscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "language" TEXT,
    "provider" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_voice_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_voice_notes_storageKey_key" ON "task_voice_notes"("storageKey");

-- CreateIndex
CREATE INDEX "task_voice_notes_taskId_idx" ON "task_voice_notes"("taskId");

-- CreateIndex
CREATE INDEX "task_voice_notes_uploadedById_idx" ON "task_voice_notes"("uploadedById");

-- CreateIndex
CREATE INDEX "task_voice_notes_transcriptionStatus_idx" ON "task_voice_notes"("transcriptionStatus");

-- CreateIndex
CREATE INDEX "task_voice_notes_createdAt_idx" ON "task_voice_notes"("createdAt");

-- CreateIndex
CREATE INDEX "task_voice_notes_deletedAt_idx" ON "task_voice_notes"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_creationSource_idx" ON "tasks"("creationSource");

-- AddForeignKey
ALTER TABLE "task_voice_notes" ADD CONSTRAINT "task_voice_notes_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_voice_notes" ADD CONSTRAINT "task_voice_notes_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
