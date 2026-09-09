-- Project form upgrade:
-- 1) multiple departments per project
-- 2) saved voice-note transcript metadata

ALTER TABLE "projects"
ADD COLUMN "voiceTranscript" TEXT,
ADD COLUMN "voiceLanguage" TEXT;

CREATE TABLE "project_departments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_departments_projectId_departmentId_key"
ON "project_departments"("projectId", "departmentId");

CREATE INDEX "project_departments_projectId_idx"
ON "project_departments"("projectId");

CREATE INDEX "project_departments_departmentId_idx"
ON "project_departments"("departmentId");

ALTER TABLE "project_departments"
ADD CONSTRAINT "project_departments_projectId_fkey"
FOREIGN KEY ("projectId")
REFERENCES "projects"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "project_departments"
ADD CONSTRAINT "project_departments_departmentId_fkey"
FOREIGN KEY ("departmentId")
REFERENCES "departments"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Preserve each project's existing single department as its first department.
INSERT INTO "project_departments" (
    "id",
    "projectId",
    "departmentId",
    "createdAt"
)
SELECT
    md5("id" || ':' || "departmentId"),
    "id",
    "departmentId",
    CURRENT_TIMESTAMP
FROM "projects"
WHERE "departmentId" IS NOT NULL
ON CONFLICT ("projectId", "departmentId") DO NOTHING;
