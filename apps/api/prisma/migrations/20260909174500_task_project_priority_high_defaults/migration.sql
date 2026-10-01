-- Phase 20.1: system-managed priority is HIGH for every project and task.
UPDATE "projects"
SET "priority" = 'HIGH'
WHERE "priority" <> 'HIGH';

UPDATE "tasks"
SET "priority" = 'HIGH'
WHERE "priority" <> 'HIGH';

ALTER TABLE "projects"
ALTER COLUMN "priority" SET DEFAULT 'HIGH';

ALTER TABLE "tasks"
ALTER COLUMN "priority" SET DEFAULT 'HIGH';
