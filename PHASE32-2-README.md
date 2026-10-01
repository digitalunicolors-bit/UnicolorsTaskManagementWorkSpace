# Phase 32.2 - Project Client Details Build Hotfix

Fixes the web build errors in Projects page where Client Servicing recent handovers were typed as a reduced client shape, so TypeScript rejected email, phone, primaryContacts and deliverables.

Changes:
- ClientServicingDashboardResponse.recentHandovers now uses the shared Client type.
- Client Servicing dashboard API now actually returns email, phone, primaryContacts and deliverables for handed-over clients.
- No workflow/status/permission logic changed.
- No database migration required for this hotfix.
