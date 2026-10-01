-- Phase 20: all projects use HIGH priority as a system-managed default.
UPDATE "projects"
SET "priority" = 'HIGH'
WHERE "priority" <> 'HIGH';
