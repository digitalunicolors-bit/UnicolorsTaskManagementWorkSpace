# Phase 29.6 — Subtask Assignee Display Fix

Fixes Work Breakdown showing `Unassigned` even when a subtask has an assignee.

## What changed
- Task detail API now includes `subtasks.assignedEmployee`.
- Work Breakdown renders the assignee directly from the subtask relation.
- Existing employee-list lookup remains as a fallback.
- No Prisma migration required.

## Files
- `apps/api/src/tasks/tasks.service.ts`
- `apps/web/src/app/(workspace)/tasks/page.tsx`
