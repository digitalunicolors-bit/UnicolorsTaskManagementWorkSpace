Phase 32.1 build hotfix

Fixes TypeScript TS2345 in clients.service.ts where workflowAccess.userId is typed string | null but Set<string>.delete requires string.

Change:
- Guard notificationUserIds.delete(...) with a userId null check.
- No workflow/UI/database behavior changed.
