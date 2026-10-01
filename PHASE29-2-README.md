# Phase 29.2 - Accounts Quotation Owner Count

- Total Quotations is now scoped to the logged-in Accounts & Quotation user.
- The card shows the logged-in Accounts employee name.
- Existing ActivityLog history is used to identify who first prepared each client quotation.
- Each client quotation counts once per preparer, so revisions do not inflate the total.
- Admin/Super Admin views keep the department/team total.
- No Prisma migration required.
