# Phase 28 — Safe Team Member Removal

Adds a Super Admin-only Team Member Management section in Settings.

Behavior:
- Existing active non-Super-Admin employees appear in a selector.
- Remove Member is a company-exit/archive flow, not a destructive hard delete.
- Removal is blocked while the member still owns/participates in active tasks or active projects; reassign that work first.
- On successful removal: login is disabled, sessions/password reset tokens are revoked, employment status becomes RESIGNED, active team/project memberships are closed, HOD/reporting-manager links are detached, and historical completed work remains preserved.
- Super Admin accounts cannot be removed through this flow.
- The action is logged in Activity Logs and login session revocation history.

No Prisma schema change or migration is required.
