Phase 32.11 - Kanban filter row + Team Members role cleanup

Kanban
- Keeps Search, Client, Project, Assignee and All Tasks status filters on one row.
- Uses compact fixed widths with horizontal overflow only when the viewport is too narrow.
- Existing automatic filtering and Clear behavior remain unchanged.

Team Members
- Renames "Designation / Role" to "Role".
- Displays the employee's actual designation/job role (e.g. Graphic Designer, Developer, Marketer).
- Removes system-role badges such as TEAM MEMBER / MANAGER from that column.
- Removes the Teams column from the table.
- No API/database changes.
