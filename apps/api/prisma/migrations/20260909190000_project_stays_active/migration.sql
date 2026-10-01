-- Projects remain ongoing. "Completed" is a task-level status in the active workflow.
-- Preserve clientApprovedAt as the audit marker for completed client-review cycles.
UPDATE "projects"
SET
  "status" = 'ACTIVE',
  "reviewStage" = NULL
WHERE
  "status" = 'COMPLETED'
  OR "reviewStage" = 'COMPLETED';
