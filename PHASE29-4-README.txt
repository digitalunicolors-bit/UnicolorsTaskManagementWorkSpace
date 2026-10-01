Phase 29.4 - Department Restore Fix

Fixes duplicate department-name 23505 errors when a department with the same name was previously soft-deleted.

Behavior:
- If an active/non-deleted department with the same name exists: returns 409 Department already exists.
- If a soft-deleted department with the same name exists: restores/reactivates that record instead of inserting a duplicate.
- Applies the submitted HOD/team data to the restored department.
- No Prisma migration required.
