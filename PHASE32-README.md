# Phase 32 - Client / Quotation / HOD Workflow

This patch implements the requested client onboarding and quotation workflow changes while leaving Google Workspace / SMTP email delivery for a later phase.

## Included
- HOD Create Task assignee dropdown now uses active department/team directory, including managed departments.
- Client action UI is a compact Manage dropdown instead of multiple large buttons.
- Approved clients remain editable/manageable by permitted Super Admin / BDM users.
- Client Requirements renamed to Client Scope of Work / Commitments.
- BDM can onboard/send for approval, but final client approval is Super Admin only.
- Client Scope / Commitment editable table with Sr., Particular / Description, Sub Description, 3 starter rows, Add Row and Add Column.
- Client stage filters: Onboarding, Client Approval, Unapproved, Quotation.
- Quotation workflow: Accounts prepares/revises -> Super Admin approves -> BDM sends -> client confirms -> Client Servicing handover.
- Super Admin receives in-app notification when a quotation is ready for approval; BDM/Accounts receive approval-change notifications.
- Payment Remark column is placed after Manage.
- Quotation modal auto-displays client company/contact/scope details.
- Project and Task create surfaces selected client details automatically; project brief defaults from client scope when creating.
- Project Create includes optional Recurring Task field beside optional deadline.
- Existing Kanban client filter behavior remains intact for role-scoped visible client/task records.

## Database migration
This phase adds persisted client scope/payment/quotation-approval fields and Project.isRecurring.
Run the committed Prisma migration and regenerate Prisma Client before API build.

## Not included
- Google Workspace / SMTP outbound email delivery. In-app notifications remain active; email integration is deferred to a later phase.
