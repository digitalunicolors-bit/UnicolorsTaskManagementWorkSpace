-- CreateEnum
CREATE TYPE "FileAccessScope" AS ENUM ('INHERITED', 'RESTRICTED');

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mentions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "clientId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "file_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "commentId" TEXT,
    "folderId" TEXT,
    "accessScope" "FileAccessScope" NOT NULL DEFAULT 'INHERITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_access_grants" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_taskId_idx" ON "comments"("taskId");

-- CreateIndex
CREATE INDEX "comments_projectId_idx" ON "comments"("projectId");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE INDEX "comments_deletedAt_idx" ON "comments"("deletedAt");

-- CreateIndex
CREATE INDEX "comment_mentions_commentId_idx" ON "comment_mentions"("commentId");

-- CreateIndex
CREATE INDEX "comment_mentions_mentionedUserId_idx" ON "comment_mentions"("mentionedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_mentions_commentId_mentionedUserId_key" ON "comment_mentions"("commentId", "mentionedUserId");

-- CreateIndex
CREATE INDEX "comment_reactions_commentId_idx" ON "comment_reactions"("commentId");

-- CreateIndex
CREATE INDEX "comment_reactions_userId_idx" ON "comment_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_commentId_userId_emoji_key" ON "comment_reactions"("commentId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "file_folders_parentId_idx" ON "file_folders"("parentId");

-- CreateIndex
CREATE INDEX "file_folders_clientId_idx" ON "file_folders"("clientId");

-- CreateIndex
CREATE INDEX "file_folders_projectId_idx" ON "file_folders"("projectId");

-- CreateIndex
CREATE INDEX "file_folders_taskId_idx" ON "file_folders"("taskId");

-- CreateIndex
CREATE INDEX "file_folders_deletedAt_idx" ON "file_folders"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_storageKey_key" ON "file_assets"("storageKey");

-- CreateIndex
CREATE INDEX "file_assets_uploadedById_idx" ON "file_assets"("uploadedById");

-- CreateIndex
CREATE INDEX "file_assets_clientId_idx" ON "file_assets"("clientId");

-- CreateIndex
CREATE INDEX "file_assets_projectId_idx" ON "file_assets"("projectId");

-- CreateIndex
CREATE INDEX "file_assets_taskId_idx" ON "file_assets"("taskId");

-- CreateIndex
CREATE INDEX "file_assets_commentId_idx" ON "file_assets"("commentId");

-- CreateIndex
CREATE INDEX "file_assets_folderId_idx" ON "file_assets"("folderId");

-- CreateIndex
CREATE INDEX "file_assets_mimeType_idx" ON "file_assets"("mimeType");

-- CreateIndex
CREATE INDEX "file_assets_createdAt_idx" ON "file_assets"("createdAt");

-- CreateIndex
CREATE INDEX "file_assets_deletedAt_idx" ON "file_assets"("deletedAt");

-- CreateIndex
CREATE INDEX "file_access_grants_fileId_idx" ON "file_access_grants"("fileId");

-- CreateIndex
CREATE INDEX "file_access_grants_userId_idx" ON "file_access_grants"("userId");

-- CreateIndex
CREATE INDEX "file_access_grants_grantedById_idx" ON "file_access_grants"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "file_access_grants_fileId_userId_key" ON "file_access_grants"("fileId", "userId");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "file_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_folders" ADD CONSTRAINT "file_folders_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "file_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_access_grants" ADD CONSTRAINT "file_access_grants_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_access_grants" ADD CONSTRAINT "file_access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_access_grants" ADD CONSTRAINT "file_access_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
