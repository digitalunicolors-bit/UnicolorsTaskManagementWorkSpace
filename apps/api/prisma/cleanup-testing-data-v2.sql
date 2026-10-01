-- Unicolors WorkSpace — one-time testing workflow data cleanup (V2)
-- PRESERVES:
--   all users / employee profiles
--   all roles / permissions
--   all departments + HOD assignments
--   all teams + team memberships
--   task/workflow master data
--   system settings
--
-- DELETES only testing workflow/business data.

BEGIN;

-- Notifications / temporary workflow noise.
DELETE FROM notification_deliveries;
DELETE FROM notifications;

-- File/comment data tied to test tasks/projects/clients.
DELETE FROM file_access_grants;
DELETE FROM file_assets;
DELETE FROM file_folders;

DELETE FROM comment_reactions;
DELETE FROM comment_mentions;
DELETE FROM comments;

-- Task execution/review data.
DELETE FROM task_voice_notes;
DELETE FROM task_approvals;
DELETE FROM task_status_history;
DELETE FROM task_reminders;
DELETE FROM task_tags;
DELETE FROM checklist_items;
DELETE FROM subtasks;
DELETE FROM task_dependencies;
DELETE FROM task_reviewers;
DELETE FROM task_followers;
DELETE FROM task_collaborators;
DELETE FROM task_assignees;
DELETE FROM time_entries;
DELETE FROM recurring_tasks;

-- Project/task/client workflow data.
DELETE FROM project_milestones;
DELETE FROM project_members;
DELETE FROM project_departments;

DELETE FROM tasks;
DELETE FROM projects;

DELETE FROM client_contacts;
DELETE FROM clients;

-- User-created testing tags only.
DELETE FROM tags;

-- IMPORTANT:
-- Do NOT delete users
-- Do NOT delete employees
-- Do NOT delete roles / user_roles
-- Do NOT delete departments
-- Do NOT clear departments.headId
-- Do NOT delete teams
-- Do NOT delete team_members
-- Do NOT delete login history / refresh tokens / notification preferences
-- Do NOT delete password-reset tokens

COMMIT;
