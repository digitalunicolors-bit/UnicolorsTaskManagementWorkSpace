Phase 30.2 - Super Admin Kanban Navigation + Employee Filter

Changes:
1. Super Admin sidebar order:
   - Kanban is the first item and direct landing remains /kanban.
   - Existing stats Dashboard is shown before Departments.
   - No duplicate Kanban/Dashboard confusion.
2. Super Admin Kanban employee filter:
   - Loads every active, non-deleted employee with an active login.
   - Employees do not need to already have a visible task to appear in the filter.
   - Other roles keep their existing scoped assignee filter behavior.

No Prisma migration required.
