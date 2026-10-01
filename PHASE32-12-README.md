Phase 32.12 - Inline employee job role editor
- Team Members table shows actual designation/job role.
- Missing roles show "Set Role" for Super Admin.
- Existing roles can be edited inline with a pencil action.
- Saves through existing PATCH /employees/:id endpoint; no DB migration.
- System access roles remain separate from job/designation roles.
