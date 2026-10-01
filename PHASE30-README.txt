Unicolors WorkSpace - Phase 30 Workflow Controls

Included:
1. Super Admin Team page: remove/disable member icon beside Status (historical work preserved).
2. Kanban: completed task Reopen action for Super Admin/Admin/HOD, returns task to In Progress and reactivates completed project when relevant.
3. Super Admin Dashboard: Dashboard opens Kanban directly; Overview remains before Departments; Total Employees stat is included; Kanban employee filter available.
4. Employee leave option removed from employee status validation and calendar leave output (DB enum retained for backward compatibility; no migration required).
5. Approved clients can be managed by Super Admin/BDM: Approve, Unapprove, Discuss while preserving Accounts/project history.
6. Subtask workflow: assigned member can Start/Pause/Complete via compact icons; managers/reviewers get updates. Starting another subtask auto-pauses any currently started sibling subtask assigned to the same member in that task.

No Prisma migration required.
Create Task layout is not modified by this patch.
