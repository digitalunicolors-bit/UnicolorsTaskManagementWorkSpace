-- CreateEnum
CREATE TYPE "TaskDependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');

-- CreateTable
CREATE TABLE "task_statuses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "departmentId" TEXT,
    "categoryId" TEXT,
    "statusId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "startDate" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "estimatedHours" DECIMAL(10,2),
    "internalNotes" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_collaborators" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "task_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_followers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reviewers" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reviewers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtasks" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedEmployeeId" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT NOT NULL,
    "type" "TaskDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_tags" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "task_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_statuses_code_key" ON "task_statuses"("code");

-- CreateIndex
CREATE INDEX "task_statuses_sortOrder_idx" ON "task_statuses"("sortOrder");

-- CreateIndex
CREATE INDEX "task_statuses_isActive_idx" ON "task_statuses"("isActive");

-- CreateIndex
CREATE INDEX "task_statuses_deletedAt_idx" ON "task_statuses"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_categories_name_key" ON "task_categories"("name");

-- CreateIndex
CREATE INDEX "task_categories_isActive_idx" ON "task_categories"("isActive");

-- CreateIndex
CREATE INDEX "task_categories_deletedAt_idx" ON "task_categories"("deletedAt");

-- CreateIndex
CREATE INDEX "tasks_clientId_idx" ON "tasks"("clientId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_departmentId_idx" ON "tasks"("departmentId");

-- CreateIndex
CREATE INDEX "tasks_categoryId_idx" ON "tasks"("categoryId");

-- CreateIndex
CREATE INDEX "tasks_statusId_idx" ON "tasks"("statusId");

-- CreateIndex
CREATE INDEX "tasks_createdById_idx" ON "tasks"("createdById");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_dueAt_idx" ON "tasks"("dueAt");

-- CreateIndex
CREATE INDEX "tasks_isCritical_idx" ON "tasks"("isCritical");

-- CreateIndex
CREATE INDEX "tasks_isDraft_idx" ON "tasks"("isDraft");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_idx" ON "tasks"("deletedAt");

-- CreateIndex
CREATE INDEX "task_assignees_taskId_idx" ON "task_assignees"("taskId");

-- CreateIndex
CREATE INDEX "task_assignees_employeeId_idx" ON "task_assignees"("employeeId");

-- CreateIndex
CREATE INDEX "task_assignees_isPrimary_idx" ON "task_assignees"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_taskId_employeeId_key" ON "task_assignees"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "task_collaborators_taskId_idx" ON "task_collaborators"("taskId");

-- CreateIndex
CREATE INDEX "task_collaborators_employeeId_idx" ON "task_collaborators"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "task_collaborators_taskId_employeeId_key" ON "task_collaborators"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "task_followers_taskId_idx" ON "task_followers"("taskId");

-- CreateIndex
CREATE INDEX "task_followers_employeeId_idx" ON "task_followers"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "task_followers_taskId_employeeId_key" ON "task_followers"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "task_reviewers_taskId_idx" ON "task_reviewers"("taskId");

-- CreateIndex
CREATE INDEX "task_reviewers_employeeId_idx" ON "task_reviewers"("employeeId");

-- CreateIndex
CREATE INDEX "task_reviewers_sortOrder_idx" ON "task_reviewers"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "task_reviewers_taskId_employeeId_key" ON "task_reviewers"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "subtasks_taskId_idx" ON "subtasks"("taskId");

-- CreateIndex
CREATE INDEX "subtasks_assignedEmployeeId_idx" ON "subtasks"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "subtasks_isCompleted_idx" ON "subtasks"("isCompleted");

-- CreateIndex
CREATE INDEX "subtasks_sortOrder_idx" ON "subtasks"("sortOrder");

-- CreateIndex
CREATE INDEX "subtasks_deletedAt_idx" ON "subtasks"("deletedAt");

-- CreateIndex
CREATE INDEX "checklist_items_taskId_idx" ON "checklist_items"("taskId");

-- CreateIndex
CREATE INDEX "checklist_items_isCompleted_idx" ON "checklist_items"("isCompleted");

-- CreateIndex
CREATE INDEX "checklist_items_sortOrder_idx" ON "checklist_items"("sortOrder");

-- CreateIndex
CREATE INDEX "checklist_items_deletedAt_idx" ON "checklist_items"("deletedAt");

-- CreateIndex
CREATE INDEX "task_dependencies_taskId_idx" ON "task_dependencies"("taskId");

-- CreateIndex
CREATE INDEX "task_dependencies_dependsOnTaskId_idx" ON "task_dependencies"("dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON "task_dependencies"("taskId", "dependsOnTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "task_tags_taskId_idx" ON "task_tags"("taskId");

-- CreateIndex
CREATE INDEX "task_tags_tagId_idx" ON "task_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "task_tags_taskId_tagId_key" ON "task_tags"("taskId", "tagId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "task_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collaborators" ADD CONSTRAINT "task_collaborators_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_followers" ADD CONSTRAINT "task_followers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_followers" ADD CONSTRAINT "task_followers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviewers" ADD CONSTRAINT "task_reviewers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reviewers" ADD CONSTRAINT "task_reviewers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employee_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
