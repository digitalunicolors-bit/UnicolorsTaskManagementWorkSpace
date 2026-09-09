-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('GENERAL', 'REFERENCE', 'WORK_SUBMISSION');

-- AlterTable
ALTER TABLE "file_assets" ADD COLUMN     "purpose" "FilePurpose" NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "file_assets_purpose_idx" ON "file_assets"("purpose");
