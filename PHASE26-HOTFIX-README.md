# Unicolors WorkSpace – Phase 26 Hotfix

Apply this ZIP over the repository root:

`D:\UnicolorsTaskManagementWorkSpace`

This hotfix contains only four replacement files and fixes:

1. Settings runtime crash: `ReferenceError: text is not defined`.
2. Super Admin > Manage Login support for Super Admin accounts, while preventing self-deactivation.
3. Multi-role HOD navigation: HR + another department HOD still receives My Tasks; HR-only HOD remains excluded.
4. Tasks page TypeScript select-event typing cleanup.

No Prisma migration is required.

After extraction run:

```powershell
cd D:\UnicolorsTaskManagementWorkSpace
pnpm --filter api build
pnpm --filter web typecheck
pnpm --filter web build
pnpm dev
```
