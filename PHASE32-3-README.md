Phase 32.3 - cumulative build hotfix

Fixes both issues together so applying this patch does not reintroduce the previous hotfix:
1. clients.service.ts: guard nullable workflowAccess.userId before Set<string>.delete().
2. projects/page.tsx: normalize the client options union explicitly to Client[] so email, phone, primaryContacts and deliverables are type-safe in the mapper.

No Prisma schema change. No migration required.
