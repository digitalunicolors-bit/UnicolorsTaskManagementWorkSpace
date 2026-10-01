# Unicolors WorkSpace — Phase 29 Consolidated Final Workflow Cleanup

This patch is based on the latest clean source uploaded on 11 Sep 2026.

Included:
- Accounts dashboard: persistent Total Quotations count using quotationPreparedAt so approved/sent/handed-over quotations remain counted.
- Quotation Amount (INR) is optional; quotation number remains required.
- Team Member sidebar restores Projects, Time Tracking and Reports.
- Team Member Projects API scope includes projects relevant to the member's own department as well as direct project membership.
- Reports endpoints are available to normal task users and remain internally scoped by ReportsService.
- HOD My Tasks is positioned before normal workspace/team navigation.
- Project deadline remains optional; UI explicitly marks it Optional.
- No-deadline permanent projects stay IN PROGRESS while review state is carried separately as Action.
- Projects UI separates Status from Action (CS Review / Client Approval / Changes Requested / Client Approved).
- Client Servicing can send permanent ACTIVE projects to client when their Action is CS Review.
- Multi-reviewer task approvals remain independent; task reaches DONE only when all required reviewers approve.
- Remaining reviewers receive a notification after another reviewer approves.
- Review/approve endpoints rely on assigned-reviewer authorization in service logic and are reachable for task viewers.
- Creative/Graphic Design tasks automatically require the active Client Servicing HOD reviewer.
- Team Member Kanban Change Request attempt shows "You are not allowed for this" before prompting.
- Compact form pass: Project, Client and Department long secondary fields moved under More Details/Team Members collapsible sections. Create Task layout was intentionally not changed.

No Prisma schema change or migration is required for this patch.
