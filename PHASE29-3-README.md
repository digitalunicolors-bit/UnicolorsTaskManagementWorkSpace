# Phase 29.3 – Client Servicing Completed Project Count

Changes:
- Adds real backend `completedProjects` count to the Client Servicing dashboard.
- Counts non-deleted projects whose status is `COMPLETED` for clients handed to Client Servicing.
- Adds a `Completed Projects` metric card linking to `/projects?status=COMPLETED`.
- Changes Client Servicing metric grid to 4 columns on XL screens so the extra metric does not increase dashboard height unnecessarily.
- Preserves Phase 29.2 quotation owner-count changes.
- No Prisma migration required.
