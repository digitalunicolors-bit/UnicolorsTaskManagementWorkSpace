# Phase 27 — Dashboard Header Cleanup

Replacement-only UI patch. No Prisma/database changes.

## What changed
- Client Servicing HOD: removed the duplicate `Client Servicing` + `Client Servicing Dashboard` page header when it is the only managed dashboard section.
- BDM / Accounts / HR HOD: removed the same redundant large dashboard headings.
- Multi-department HOD: retains only a compact section label when multiple dashboard sections are visible, so sections remain understandable without wasting vertical space.
- Super Admin: removed the repeated `System Control Center / Super Admin Dashboard` heading while preserving Refresh, Critical Task, and Create Task actions.
- Global workspace greeting spacing tightened slightly.
- Functional card/section titles are unchanged.

## Verification
From repository root run:

```powershell
pnpm --filter web typecheck
pnpm --filter web build
```
