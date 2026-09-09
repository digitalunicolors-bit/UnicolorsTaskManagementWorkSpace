'use client';

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AlertTriangle,
  Edit3,
  Flag,
  Loader2,
  Link2,
  ListChecks,
  Mic,
  Paperclip,
  Plus,
  Repeat2,
  Tags,
  RefreshCcw,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/components/auth/auth-provider';
import { TaskCommunicationPanel } from '@/components/tasks/task-communication-panel';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface TaskStatus {
  id: string;
  code: string;
  name: string;
  color?: string | null;
}

interface TaskCategory {
  id: string;
  name: string;
  color?: string | null;
}

interface Client {
  id: string;
  name: string;
  companyName?: string | null;
}

interface Project {
  id: string;
  name: string;
  clientId?: string;
  departmentId?: string | null;
  department?: Department | null;
  departments?: Department[];
  priority?: Priority;
  client?: Client;
}


interface Department {
  id: string;
  name: string;
}

interface TagRecord {
  id: string;
  name: string;
  color?: string | null;
}

interface TaskTagLink {
  id: string;
  tagId: string;
  tag: TagRecord;
}

interface SubtaskRecord {
  id: string;
  taskId: string;
  title: string;
  description?: string | null;
  assignedEmployeeId?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
  sortOrder: number;
}

interface ChecklistRecord {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string | null;
  sortOrder: number;
}

interface DependencyRecord {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: string;
  dependsOn: {
    id: string;
    title: string;
    project?: { id: string; name: string };
    status: TaskStatus;
  };
}

interface DependencyOption {
  id: string;
  title: string;
  projectId: string;
  clientId: string;
  project: { id: string; name: string };
  client: { id: string; name: string };
  status: TaskStatus;
}

interface TaskExtraOptions {
  tags: TagRecord[];
  dependencyTasks: DependencyOption[];
}

interface Employee {
  id: string;
  employeeId?: string;
  username?: string | null;
  fullName: string;
  designation?: string | null;
}

interface TaskPerson {
  id: string;
  employeeId: string;
  isPrimary?: boolean;
  employee: Employee;
}

interface TaskApproval {
  id: string;
  reviewerId?: string | null;
  status:
    | 'PENDING'
    | 'APPROVED'
    | 'CHANGES_REQUESTED'
    | 'REJECTED'
    | 'CANCELLED';
  decisionNote?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
}
interface Task {
  id: string;
  title: string;
  description?: string | null;

  clientId: string;
  projectId: string;
  departmentId?: string | null;
  categoryId?: string | null;
  statusId: string;

  priority: Priority;

  startDate?: string | null;
  dueAt?: string | null;

  estimatedHours?: string | number | null;
  loggedTimeSeconds?: number;
  internalNotes?: string | null;

  isDraft: boolean;
  isCritical: boolean;

  createdAt: string;
  updatedAt: string;

  client: Client;
  project: Project;

  status: TaskStatus;
  category?: TaskCategory | null;
  department?: Department | null;

  tags?: TaskTagLink[];
  subtasks?: SubtaskRecord[];
  checklist?: ChecklistRecord[];
  dependencies?: DependencyRecord[];

  assignees: TaskPerson[];

  collaborators?: TaskPerson[];
  reviewers?: TaskPerson[];
  approvals?: TaskApproval[];

  _count?: {
    subtasks?: number;
    checklist?: number;
    comments?: number;
    files?: number;
  };
}

interface TasksResponse {
  data: Task[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TaskMeta {
  statuses: TaskStatus[];
  categories: TaskCategory[];
  priorities: Priority[];
}

type ModalMode =
  | 'create'
  | 'edit'
  | 'view'
  | null;

function getErrorMessage(
  value: unknown,
  fallback: string,
) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value
  ) {
    const message = (
      value as {
        message?: string | string[];
      }
    ).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

function unwrapList<T>(
  value: unknown,
): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray(
      (value as { data?: unknown }).data,
    )
  ) {
    return (
      value as {
        data: T[];
      }
    ).data;
  }

  return [];
}

export default function TasksPage() {
  const {
    authFetch,
    hasPermission,
    user,
  } = useAuth();

  const searchParams = useSearchParams();

const criticalMode =
  searchParams.get('critical') === '1';

const linkedCreateMode =
  searchParams.get('create') === '1';

const linkedProjectId =
  searchParams.get('projectId') ?? '';

const linkedDepartmentId =
  searchParams.get('departmentId') ?? '';

  const isAdmin =
    Boolean(
      user?.roles?.includes('ADMIN') &&
        !user?.roles?.includes('SUPER_ADMIN'),
    );

  const isManager =
    Boolean(
      user?.roles?.includes('MANAGER') &&
        !user?.roles?.includes('ADMIN') &&
        !user?.roles?.includes('SUPER_ADMIN'),
    );

  const isTeamMember =
    Boolean(
      user?.roles?.includes('EMPLOYEE') &&
        !user?.roles?.includes('MANAGER') &&
        !user?.roles?.includes('ADMIN') &&
        !user?.roles?.includes('SUPER_ADMIN'),
    );

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);


  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [extraOptions, setExtraOptions] =
    useState<TaskExtraOptions>({
      tags: [],
      dependencyTasks: [],
    });

  const [meta, setMeta] =
    useState<TaskMeta>({
      statuses: [],
      categories: [],
      priorities: [
        'LOW',
        'MEDIUM',
        'HIGH',
        'URGENT',
      ],
    });

  const [search, setSearch] =
    useState('');

  const [statusId, setStatusId] =
    useState('');

  const [priority, setPriority] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [modal, setModal] =
    useState<ModalMode>(null);

  const [
    selectedTask,
    setSelectedTask,
  ] = useState<Task | null>(null);
   
  const canCreate =
     hasPermission('tasks.create');

 const canUpdate =
  hasPermission('tasks.update');

const canAssign =
  hasPermission('tasks.assign');

const canReview =
  hasPermission('tasks.review');

const canApprove =
  hasPermission('tasks.approve');

const canDelete =
  hasPermission('tasks.delete');

const canComment =
  hasPermission('comments.create');

const canManageComments =
  hasPermission('comments.manage');

const canUploadFiles =
  hasPermission('files.upload');

const canDownloadFiles =
  hasPermission('files.download');

const canManageFiles =
  hasPermission('files.manage');

  const canViewEmployees =
  hasPermission('employees.view');

  const canViewDepartments =
  hasPermission('departments.view');

  const request = useCallback(
    async <T,>(
      path: string,
      options?: RequestInit,
    ): Promise<T> => {
      const response =
        await authFetch(path, options);

      let result: unknown = null;

      try {
        result =
          await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            result,
            'Request failed.',
          ),
        );
      }

      return result as T;
    },
    [authFetch],
  );
  useEffect(() => {
  if (
    (criticalMode || linkedCreateMode) &&
    canCreate
  ) {
    setSelectedTask(null);
    setModal('create');
  }
}, [
  criticalMode,
  linkedCreateMode,
  canCreate,
]);

  const loadTasks =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const params =
          new URLSearchParams();

        params.set('limit', '100');
        params.set(
          'sortBy',
          'createdAt',
        );
        params.set(
          'sortOrder',
          'desc',
        );

        if (search.trim()) {
          params.set(
            'search',
            search.trim(),
          );
        }

        if (statusId) {
          params.set(
            'statusId',
            statusId,
          );
        }

        if (priority) {
          params.set(
            'priority',
            priority,
          );
        }

        const result =
          await request<TasksResponse>(
            `/tasks?${params.toString()}`,
          );

        setTasks(result.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load tasks.',
        );
      } finally {
        setLoading(false);
      }
    }, [
      request,
      search,
      statusId,
      priority,
    ]);

  const loadOptions =
    useCallback(async () => {
      try {
        const [
          taskMeta,
          clientResult,
          projectResult,
          employeeResult,
          departmentResult,
          extrasResult,
        ] = await Promise.all([
          request<TaskMeta>(
            '/tasks/meta/options',
          ),
          request<unknown>(
            '/clients?limit=100',
          ),
          request<unknown>(
            '/projects?limit=100',
          ),
          canViewEmployees
            ? request<any>('/employees')
            : Promise.resolve({ data: [] } as any),
          canViewDepartments
            ? request<unknown>('/departments?limit=100')
            : Promise.resolve({ data: [] }),
          canCreate
            ? request<TaskExtraOptions>('/task-extras/options')
            : Promise.resolve({
                tags: [],
                dependencyTasks: [],
              } as TaskExtraOptions),
        ]);

        setMeta(taskMeta);
        setClients(unwrapList<Client>(clientResult));
        setProjects(unwrapList<Project>(projectResult));
        setEmployees(unwrapList<Employee>(employeeResult));
        setDepartments(unwrapList<Department>(departmentResult));
        setExtraOptions(extrasResult);
      } catch (err) {
        console.error(err);
      }
    }, [
      request,
      canViewEmployees,
      canViewDepartments,
      canCreate,
    ]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    const timer =
      setTimeout(() => {
        void loadTasks();
      }, 250);

    return () =>
      clearTimeout(timer);
  }, [loadTasks]);

  const openCreate = () => {
    setSelectedTask(null);
    setError('');
    setModal('create');
  };

  const openEdit = (
    task: Task,
  ) => {
    setSelectedTask(task);
    setError('');
    setModal('edit');
  };

  const openView = async (
    task: Task,
  ) => {
    setError('');

    try {
      const fresh =
        await request<Task>(
          `/tasks/${task.id}`,
        );

      setSelectedTask(fresh);
      setModal('view');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load task.',
      );
    }
  };

  const refreshSelectedTask = async () => {
    if (!selectedTask) return;

    try {
      const fresh = await request<Task>(
        `/tasks/${selectedTask.id}`,
      );
      setSelectedTask(fresh);
      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to refresh task.',
      );
    }
  };

  const closeModal = () => {
  setModal(null);
  setSelectedTask(null);
  setError('');
};

const runWorkflowAction = async (
  action:
    | 'submit-review'
    | 'request-changes'
    | 'resume-work'
    | 'approve',
) => {
  if (!selectedTask) {
    return;
  }

  const note = window.prompt(
    'Add a note (optional):',
  );

  if (note === null) {
    return;
  }

  setSaving(true);
  setError('');

  try {
    const updatedTask =
      await request<Task>(
        `/tasks/${selectedTask.id}/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            note:
              note.trim() ||
              undefined,
          }),
        },
      );

    setSelectedTask(updatedTask);

    await loadTasks();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Unable to update workflow.',
    );
  } finally {
    setSaving(false);
  }
};

  const createTask = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const assigneeIds = form
      .getAll('assigneeIds')
      .map(String)
      .filter(Boolean);

    const collaboratorIds = form
      .getAll('collaboratorIds')
      .map(String)
      .filter(Boolean);

    const reviewerIds = form
      .getAll('reviewerIds')
      .map(String)
      .filter(Boolean);

    const primaryAssigneeId = String(
      form.get('primaryAssigneeId') ?? '',
    );

    const estimatedHours = String(
      form.get('estimatedHours') ?? '',
    ).trim();

    const subtaskTitles = form
      .getAll('subtaskTitle')
      .map(String);
    const subtaskAssignees = form
      .getAll('subtaskAssigneeId')
      .map(String);

    const subtasks = subtaskTitles
      .map((title, index) => ({
        title: title.trim(),
        assignedEmployeeId:
          subtaskAssignees[index] || undefined,
        sortOrder: index,
      }))
      .filter((item) => item.title);

    const checklist = form
      .getAll('checklistItem')
      .map(String)
      .map((title, index) => ({
        title: title.trim(),
        sortOrder: index,
      }))
      .filter((item) => item.title);

    const tagNames = String(
      form.get('tagNames') ?? '',
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const dependencyIds = form
      .getAll('dependencyIds')
      .map(String)
      .filter(Boolean);

    const attachments = form
      .getAll('attachments')
      .filter(
        (value): value is File =>
          value instanceof File && value.size > 0,
      );

    const voiceNoteValue = form.get('voiceNote');
    const voiceNote =
      voiceNoteValue instanceof File && voiceNoteValue.size > 0
        ? voiceNoteValue
        : null;

    const voiceDurationRaw = String(
      form.get('voiceDurationSeconds') ?? '',
    ).trim();
    const voiceDurationSeconds = voiceDurationRaw
      ? Math.max(1, Math.min(600, Number(voiceDurationRaw) || 1))
      : null;

    const voiceTranscript = String(
      form.get('voiceTranscript') ?? '',
    ).trim();

    const voiceTranscriptLanguage = String(
      form.get('voiceTranscriptLanguage') ?? '',
    ).trim();

    const recurringEnabled =
      form.get('recurringEnabled') === 'on';

    setSaving(true);
    setError('');

    let createdTask: Task | null = null;

    try {
      createdTask = await request<Task>('/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          description:
            String(form.get('description') ?? '') || undefined,
          clientId: String(form.get('clientId') ?? ''),
          projectId: String(form.get('projectId') ?? ''),
          departmentId:
            String(form.get('departmentId') ?? '') || undefined,
          categoryId:
            String(form.get('categoryId') ?? '') || undefined,
          statusId:
            String(form.get('statusId') ?? '') || undefined,
          priority: form.has('priority')
            ? String(form.get('priority') ?? 'MEDIUM')
            : undefined,
          dueAt:
            normalizeDateTime(
              String(form.get('dueAt') ?? ''),
            ) || undefined,
          estimatedHours: estimatedHours
            ? Number(estimatedHours)
            : undefined,
          internalNotes:
            String(form.get('internalNotes') ?? '') || undefined,
          isDraft: form.get('isDraft') === 'on',
          isCritical: form.get('isCritical') === 'on',
          notifyAssignee:
            form.get('notifyAssignee') === 'on',
          primaryAssigneeId:
            primaryAssigneeId || undefined,
          assigneeIds,
          collaboratorIds,
          reviewerIds,
        }),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Task creation failed.',
      );
      setSaving(false);
      return;
    }

    try {
      if (
        subtasks.length ||
        checklist.length ||
        tagNames.length ||
        dependencyIds.length
      ) {
        await request(
          `/task-extras/task/${createdTask.id}/setup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subtasks,
              checklist,
              tagNames,
              dependencyIds,
            }),
          },
        );
      }

      if (attachments.length && canUploadFiles) {
        for (const file of attachments) {
          const uploadForm = new FormData();
          uploadForm.append('file', file);
          uploadForm.append('purpose', 'REFERENCE');

          const response = await authFetch(
            `/files/task/${createdTask.id}`,
            {
              method: 'POST',
              body: uploadForm,
            },
          );

          if (!response.ok) {
            let uploadError: unknown = null;
            try {
              uploadError = await response.json();
            } catch {}
            throw new Error(
              getErrorMessage(
                uploadError,
                `Unable to upload ${file.name}.`,
              ),
            );
          }
        }
      }

      if (voiceNote && canUploadFiles) {
        const voiceForm = new FormData();
        voiceForm.append('file', voiceNote);

        if (voiceTranscriptLanguage) {
          voiceForm.append('language', voiceTranscriptLanguage);
        }

        if (voiceDurationSeconds !== null) {
          voiceForm.append(
            'durationSeconds',
            String(voiceDurationSeconds),
          );
        }

        const response = await authFetch(
          `/voice-notes/task/${createdTask.id}`,
          {
            method: 'POST',
            body: voiceForm,
          },
        );

        if (!response.ok) {
          let voiceError: unknown = null;
          try {
            voiceError = await response.json();
          } catch {}
          throw new Error(
            getErrorMessage(
              voiceError,
              'Task created, but the voice note could not be uploaded.',
            ),
          );
        }

        let uploadedVoice: {
          id?: string;
        } | null = null;

        try {
          uploadedVoice =
            (await response.json()) as {
              id?: string;
            };
        } catch {}

        if (
          voiceTranscript &&
          uploadedVoice?.id
        ) {
          await request(
            `/voice-notes/${uploadedVoice.id}/transcript`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                transcript:
                  voiceTranscript,
                language:
                  voiceTranscriptLanguage ||
                  undefined,
              }),
            },
          );
        }
      }

      if (recurringEnabled) {
        const recurrenceStart =
          normalizeDateTime(
            String(form.get('recurrenceStartAt') ?? ''),
          ) ||
          normalizeDateTime(
            String(form.get('dueAt') ?? ''),
          ) ||
          new Date().toISOString();

        await request('/recurring-tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateTaskId: createdTask.id,
            frequency: String(
              form.get('recurrenceFrequency') ?? 'WEEKLY',
            ),
            interval: Math.max(
              1,
              Number(form.get('recurrenceInterval') ?? 1) || 1,
            ),
            weekdays: form
              .getAll('recurrenceWeekdays')
              .map((value) => Number(value)),
            dayOfMonth:
              String(form.get('recurrenceDayOfMonth') ?? '').trim()
                ? Number(form.get('recurrenceDayOfMonth'))
                : undefined,
            startAt: recurrenceStart,
            endAt:
              normalizeDateTime(
                String(form.get('recurrenceEndAt') ?? ''),
              ) || undefined,
          }),
        });
      }

      closeModal();
      await loadTasks();
      await loadOptions();
    } catch (err) {
      await loadTasks();
      try {
        const fresh = await request<Task>(
          `/tasks/${createdTask.id}`,
        );
        setSelectedTask(fresh);
        setModal('view');
      } catch {}

      setError(
        `Task was created, but additional setup needs attention: ${
          err instanceof Error ? err.message : 'Setup failed.'
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedTask) {
      return;
    }

    const form =
      new FormData(
        event.currentTarget,
      );

    const primaryAssigneeId = String(
      form.get('primaryAssigneeId') ?? '',
    ).trim();

    const selectedAssigneeIds = Array.from(
      new Set(
        form
          .getAll('assigneeIds')
          .map(String)
          .filter(Boolean),
      ),
    );

    if (
      primaryAssigneeId &&
      !selectedAssigneeIds.includes(primaryAssigneeId)
    ) {
      selectedAssigneeIds.push(primaryAssigneeId);
    }

    const selectedCollaboratorIds = Array.from(
      new Set(
        form
          .getAll('collaboratorIds')
          .map(String)
          .filter(Boolean),
      ),
    );

    const selectedReviewerIds = Array.from(
      new Set(
        form
          .getAll('reviewerIds')
          .map(String)
          .filter(Boolean),
      ),
    );

    setSaving(true);
    setError('');

    try {
      await request(
        `/tasks/${selectedTask.id}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            title: String(
              form.get('title') ??
                '',
            ),

            description:
              String(
                form.get(
                  'description',
                ) ?? '',
              ),

            clientId: String(
              form.get('clientId') ??
                '',
            ),

            projectId: String(
              form.get('projectId') ??
                '',
            ),

            departmentId:
              String(
                form.get(
                  'departmentId',
                ) ?? '',
              ) || null,

           priority: String(
              form.get('priority') ??
                'MEDIUM',
            ),

            dueAt:
              normalizeDateTime(
                String(
                  form.get(
                    'dueAt',
                  ) ?? '',
                ),
              ) || null,

            internalNotes:
              String(
                form.get(
                  'internalNotes',
                ) ?? '',
              ),

            isDraft:
              form.get(
                'isDraft',
              ) === 'on',

            isCritical:
              form.get(
                'isCritical',
              ) === 'on',
          }),
        },
      );

      if (canAssign) {
        const existingAssigneeIds =
          selectedTask.assignees.map((item) => item.employeeId);
        const existingCollaboratorIds =
          selectedTask.collaborators?.map((item) => item.employeeId) ?? [];
        const existingReviewerIds =
          selectedTask.reviewers?.map((item) => item.employeeId) ?? [];

        const assigneesToRemove = existingAssigneeIds.filter(
          (id) => !selectedAssigneeIds.includes(id),
        );
        const collaboratorsToAdd = selectedCollaboratorIds.filter(
          (id) => !existingCollaboratorIds.includes(id),
        );
        const collaboratorsToRemove = existingCollaboratorIds.filter(
          (id) => !selectedCollaboratorIds.includes(id),
        );
        const reviewersToAdd = selectedReviewerIds.filter(
          (id) => !existingReviewerIds.includes(id),
        );
        const reviewersToRemove = existingReviewerIds.filter(
          (id) => !selectedReviewerIds.includes(id),
        );

        const currentPrimaryId =
          selectedTask.assignees.find((item) => item.isPrimary)?.employeeId ??
          selectedTask.assignees[0]?.employeeId ??
          '';

        const assigneeSetChanged =
          existingAssigneeIds.length !== selectedAssigneeIds.length ||
          existingAssigneeIds.some(
            (id) => !selectedAssigneeIds.includes(id),
          );

        if (
          selectedAssigneeIds.length > 0 &&
          (assigneeSetChanged || primaryAssigneeId !== currentPrimaryId)
        ) {
          await request(`/tasks/${selectedTask.id}/assignees`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              employeeIds: selectedAssigneeIds,
              primaryEmployeeId: primaryAssigneeId || undefined,
            }),
          });
        }

        if (collaboratorsToAdd.length > 0) {
          await request(`/tasks/${selectedTask.id}/collaborators`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ employeeIds: collaboratorsToAdd }),
          });
        }

        if (reviewersToAdd.length > 0) {
          await request(`/tasks/${selectedTask.id}/reviewers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ employeeIds: reviewersToAdd }),
          });
        }

        if (assigneesToRemove.length > 0) {
          await request(`/tasks/${selectedTask.id}/assignees`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ employeeIds: assigneesToRemove }),
          });
        }

        if (collaboratorsToRemove.length > 0) {
          await request(`/tasks/${selectedTask.id}/collaborators`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ employeeIds: collaboratorsToRemove }),
          });
        }

        if (reviewersToRemove.length > 0) {
          await request(`/tasks/${selectedTask.id}/reviewers`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ employeeIds: reviewersToRemove }),
          });
        }
      }

      closeModal();

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Task update failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (
    task: Task,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${task.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `/tasks/${task.id}`,
        {
          method: 'DELETE',
        },
      );

      await loadTasks();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'Unable to delete task.',
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            {isTeamMember ? 'My Tasks' : 'Tasks'}
          </h1>

        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void loadTasks()
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {(isAdmin || isManager) && canCreate && (
            <Link
              href="/tasks?critical=1"
              aria-label="Critical Task"
              title="Critical Task"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white transition hover:bg-red-700"
            >
              <AlertTriangle className="h-4 w-4" />
            </Link>
          )}

          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Create Task
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search tasks..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={statusId}
            onChange={(event) =>
              setStatusId(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">
              All Statuses
            </option>

            {meta.statuses.map(
              (status) => (
                <option
                  key={status.id}
                  value={status.id}
                >
                  {status.name}
                </option>
              ),
            )}
          </select>

          <select
            value={priority}
            onChange={(event) =>
              setPriority(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">
              All Priorities
            </option>

            {meta.priorities.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ),
            )}
          </select>
        </div>

        {error && !modal && (
          <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <TasksTable
            tasks={tasks}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onView={openView}
            onEdit={openEdit}
            onDelete={removeTask}
          />
        )}
      </div>

      {modal === 'create' && (
        <Modal
          title="Create Task"
          error={error}
          onClose={closeModal}
        >
          <TaskForm
  meta={meta}
  clients={clients}
  projects={projects}
  employees={employees}
  departments={departments}
  extraOptions={extraOptions}
  availableTasks={extraOptions.dependencyTasks}
  canUploadFiles={canUploadFiles}
  canAssignPeople={canAssign}
  saving={saving}
  onSubmit={createTask}
  criticalDefault={criticalMode}
  initialProjectId={linkedProjectId}
  initialDepartmentId={linkedDepartmentId}
/>
        </Modal>
      )}

      {modal === 'edit' &&
        selectedTask && (
          <Modal
            title="Edit Task"
            error={error}
            onClose={closeModal}
          >
            <TaskForm
              task={selectedTask}
              meta={meta}
              clients={clients}
              projects={projects}
              employees={employees}
              departments={departments}
              extraOptions={extraOptions}
              availableTasks={extraOptions.dependencyTasks}
              canUploadFiles={canUploadFiles}
              canAssignPeople={canAssign}
              saving={saving}
              onSubmit={updateTask}
            />
          </Modal>
        )}

      {modal === 'view' &&
        selectedTask && (
          <Modal
            title={selectedTask.title}
            error={error}
            onClose={closeModal}
          >
            <TaskDetails
              task={selectedTask}
            />


            <TaskExtrasPanel
              task={selectedTask}
              employees={employees}
              canManage={canCreate}
              canUpdate={canUpdate}
              onChanged={refreshSelectedTask}
            />

            <TaskCommunicationPanel
              taskId={selectedTask.id}
              canComment={canComment}
              canManageComments={canManageComments}
              canUpload={canUploadFiles}
              canDownload={canDownloadFiles}
              canManageFiles={canManageFiles}
              onChanged={() => {
                void refreshSelectedTask();
              }}
            />

            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">

  {selectedTask.status.code ===
    'IN_PROGRESS' &&
    canUpdate && (
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          void runWorkflowAction(
            'submit-review',
          )
        }
        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving
          ? 'Processing...'
          : 'Submit for Review'}
      </button>
    )}

  {[
    'REVIEW',
    'INTERNAL_REVIEW',
    'CLIENT_REVIEW',
  ].includes(
    selectedTask.status.code,
  ) &&
    canReview && (
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          void runWorkflowAction(
            'request-changes',
          )
        }
        className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-semibold text-amber-700 disabled:opacity-50"
      >
        Request Changes
      </button>
    )}

  {[
    'REVIEW',
    'CLIENT_REVIEW',
  ].includes(
    selectedTask.status.code,
  ) &&
    canApprove && (
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          void runWorkflowAction(
            'approve',
          )
        }
        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving
          ? 'Processing...'
          : 'Approve Task'}
      </button>
    )}

  {selectedTask.status.code ===
    'CHANGES_REQUESTED' &&
    canUpdate && (
      <button
        type="button"
        disabled={saving}
        onClick={() =>
          void runWorkflowAction(
            'resume-work',
          )
        }
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Resume Work
      </button>
    )}
</div>
          </Modal>
        )}
    </div>
  );
}

function TasksTable({
  tasks,
  canUpdate,
  canDelete,
  onView,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  canUpdate: boolean;
  canDelete: boolean;

  onView: (
    task: Task,
  ) => void;

  onEdit: (
    task: Task,
  ) => void;

  onDelete: (
    task: Task,
  ) => void;
}) {
  if (!tasks.length) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        No tasks found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-4">
              Task
            </th>

            <th className="px-5 py-4">
              Project
            </th>

            <th className="px-5 py-4">
              Assignee
            </th>

            <th className="px-5 py-4">
              Due
            </th>

            <th className="px-5 py-4">
              Priority
            </th>

            <th className="px-5 py-4">
              Status
            </th>

            <th className="px-5 py-4">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => {
            const primary =
              task.assignees.find(
                (item) =>
                  item.isPrimary,
              ) ??
              task.assignees[0];

            return (
              <tr
                key={task.id}
                className="border-t border-slate-100"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() =>
                      void onView(task)
                    }
                    className="text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-950">
                        {task.title}
                      </p>

                      {task.isCritical && (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>

                    <p className="mt-1 text-xs text-slate-400">
                      {
                        task.client
                          .name
                      }

                      {task.isDraft
                        ? ' · Draft'
                        : ''}
                    </p>
                  </button>
                </td>

                <td className="px-5 py-4">
                  {task.project.name}
                </td>

                <td className="px-5 py-4">
                  {primary?.employee
                    .fullName ?? '—'}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={
                      isOverdue(task)
                        ? 'font-semibold text-red-600'
                        : ''
                    }
                  >
                    {formatDateTime(
                      task.dueAt,
                    )}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <PriorityBadge
                    priority={
                      task.priority
                    }
                  />
                </td>

                <td className="px-5 py-4">
                  <StatusBadge
                    status={
                      task.status
                    }
                  />
                </td>

                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void onView(
                          task,
                        )
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"
                    >
                      View
                    </button>

                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() =>
                          onEdit(task)
                        }
                        className="rounded-lg border border-slate-200 p-2"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() =>
                          void onDelete(
                            task,
                          )
                        }
                        className="rounded-lg border border-red-200 p-2 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskForm({
  task,
  meta,
  clients,
  projects,
  employees,
  departments,
  extraOptions,
  availableTasks,
  canUploadFiles,
  canAssignPeople,
  saving,
  onSubmit,
  criticalDefault = false,
  initialProjectId = '',
  initialDepartmentId = '',
}: {
  task?: Task;
  meta: TaskMeta;
  clients: Client[];
  projects: Project[];
  employees: Employee[];
  departments: Department[];
  extraOptions: TaskExtraOptions;
  availableTasks: DependencyOption[];
  canUploadFiles: boolean;
  canAssignPeople: boolean;
  saving: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
  criticalDefault?: boolean;
  initialProjectId?: string;
  initialDepartmentId?: string;
}) {
  const { authFetch } = useAuth();

  const [selectedClientId, setSelectedClientId] =
    useState(task?.clientId ?? '');
  const [selectedProjectId, setSelectedProjectId] =
    useState(task?.projectId ?? initialProjectId);

  const [reviewerOptions, setReviewerOptions] =
    useState<Employee[]>([]);

  useEffect(() => {
    let active = true;

    if (!canAssignPeople) {
      setReviewerOptions([]);
      return () => {
        active = false;
      };
    }

    const loadReviewerOptions = async () => {
      try {
        const params = new URLSearchParams();

        if (selectedProjectId) {
          params.set('projectId', selectedProjectId);
        }

        const suffix = params.toString()
          ? `?${params.toString()}`
          : '';

        const response = await authFetch(
          `/tasks/meta/reviewer-options${suffix}`,
        );

        if (!response.ok) {
          if (active) {
            setReviewerOptions([]);
          }
          return;
        }

        const result = await response.json();

        if (active) {
          setReviewerOptions(
            unwrapList<Employee>(result),
          );
        }
      } catch {
        if (active) {
          setReviewerOptions([]);
        }
      }
    };

    void loadReviewerOptions();

    return () => {
      active = false;
    };
  }, [
    authFetch,
    canAssignPeople,
    selectedProjectId,
  ]);

  const [selectedPriority, setSelectedPriority] =
    useState<Priority>(
      task?.priority ??
        projects.find(
          (project) =>
            project.id ===
            task?.projectId,
        )?.priority ??
        'MEDIUM',
    );

  const getProjectClientId = (project: Project) =>
    project.clientId ?? project.client?.id ?? '';

  useEffect(() => {
    if (task || !initialProjectId) return;

    const linkedProject = projects.find(
      (project) => project.id === initialProjectId,
    );

    if (!linkedProject) return;

    setSelectedProjectId(initialProjectId);

    const linkedClientId = getProjectClientId(linkedProject);
    if (linkedClientId) {
      setSelectedClientId(linkedClientId);
    }
  }, [initialProjectId, projects, task]);

  const handleClientChange = (value: string) => {
    setSelectedClientId(value);
    if (!selectedProjectId) return;

    const selectedProject = projects.find(
      (project) => project.id === selectedProjectId,
    );

    if (!selectedProject) {
      setSelectedProjectId('');

      if (!task) {
        setSelectedPriority(
          'MEDIUM',
        );
      }

      return;
    }

    const projectClientId = getProjectClientId(selectedProject);
    if (value && projectClientId && projectClientId !== value) {
      setSelectedProjectId('');

      if (!task) {
        setSelectedPriority(
          'MEDIUM',
        );
      }
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProjectId(value);
    if (!value) return;

    const selectedProject = projects.find(
      (project) => project.id === value,
    );
    if (!selectedProject) return;

    const projectClientId = getProjectClientId(selectedProject);
    if (projectClientId) setSelectedClientId(projectClientId);

    if (
      !task &&
      selectedProject.priority
    ) {
      setSelectedPriority(
        selectedProject.priority,
      );
    }
  };

  const getProjectLabel = (project: Project) => {
    const projectClientId = getProjectClientId(project);
    const clientName =
      project.client?.name ??
      clients.find((client) => client.id === projectClientId)?.name;

    return clientName
      ? `${project.name} — ${clientName}`
      : project.name;
  };

  const selectedProjectForForm =
    projects.find((project) => project.id === selectedProjectId) ?? null;

  const selectedProjectDepartmentIds = new Set(
    selectedProjectForForm?.departments?.length
      ? selectedProjectForForm.departments.map((department) => department.id)
      : selectedProjectForForm?.department?.id
        ? [selectedProjectForForm.department.id]
        : selectedProjectForForm?.departmentId
          ? [selectedProjectForForm.departmentId]
          : [],
  );

  const taskDepartmentOptions = selectedProjectDepartmentIds.size
    ? departments.filter((department) =>
        selectedProjectDepartmentIds.has(department.id),
      )
    : departments;

  const effectiveClientId =
    selectedClientId ||
    (selectedProjectForForm
      ? getProjectClientId(selectedProjectForForm)
      : '');

  const selectedClientForForm =
    clients.find((client) => client.id === effectiveClientId) ??
    selectedProjectForForm?.client ??
    null;

  const contextDepartment =
    initialDepartmentId
      ? taskDepartmentOptions.find(
          (department) => department.id === initialDepartmentId,
        ) ?? null
      : null;

  const autoDepartment =
    contextDepartment ??
    (taskDepartmentOptions.length === 1
      ? taskDepartmentOptions[0]
      : null);

  const linkedProjectContext = Boolean(
    !task && initialProjectId && selectedProjectForForm,
  );

  const primaryAssignee =
    task?.assignees.find((item) => item.isPrimary)?.employeeId ??
    task?.assignees[0]?.employeeId ??
    '';

  if (!task) {
    const visibleProjects = effectiveClientId
      ? projects.filter(
          (project) =>
            getProjectClientId(project) === effectiveClientId,
        )
      : projects;

    return (
      <form
        onSubmit={onSubmit}
        className="grid gap-x-2.5 gap-y-2 md:grid-cols-2 lg:grid-cols-6"
      >
        {linkedProjectContext && (
          <div className="md:col-span-2 lg:col-span-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {selectedClientForForm?.name ?? 'Client'}
            </span>
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {selectedProjectForForm?.name ?? 'Project'}
            </span>
            {autoDepartment && (
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                {autoDepartment.name}
              </span>
            )}
          </div>
        )}

        <div className={linkedProjectContext ? 'hidden' : 'lg:col-span-3'}>
          <Select
          name="clientId"
          label="Client"
          required
          value={effectiveClientId}
          onChange={handleClientChange}
        >
          <option value="">Select Client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
          </Select>
        </div>

        <div className={linkedProjectContext ? 'hidden' : 'lg:col-span-3'}>
          <Select
          name="projectId"
          label="Project"
          required
          value={selectedProjectId}
          onChange={handleProjectChange}
        >
          <option value="">Select Project</option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
          </Select>
        </div>

        {autoDepartment ? (
          <input type="hidden" name="departmentId" value={autoDepartment.id} />
        ) : selectedProjectForForm ? (
          <div className="md:col-span-2 lg:col-span-3">
            <Select
              name="departmentId"
              label="Department"
              required
              defaultValue=""
            >
              <option value="">Select Department</option>
              {taskDepartmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <input type="hidden" name="priority" value={selectedPriority} />

        <div className="lg:col-span-3">
          <Input
            name="title"
            label="Task Name"
            required
          />
        </div>

        <div className="lg:col-span-3">
          <Select
            name="primaryAssigneeId"
            label="Assign To"
            defaultValue=""
          >
            <option value="">Select Assignee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
                {employee.designation ? ` — ${employee.designation}` : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="lg:col-span-2">
          <Input
            name="dueAt"
            label="Deadline"
            type="date"
          />
        </div>

        <div className="md:col-span-2 lg:col-span-4">
          <AutoGrowTextarea
            name="description"
            label="Brief"
          />
        </div>

        {canAssignPeople && (
          <div className="md:col-span-2 lg:col-span-6">
            <PeopleSelector
              title="Reviewer"
              name="reviewerIds"
              employees={reviewerOptions}
              checkedIds={[]}
              emptyText="No eligible reviewers available."
            />
          </div>
        )}

        {canUploadFiles && (
          <div className="md:col-span-2 lg:col-span-6">
            <CreateTaskVoiceInput />
          </div>
        )}

        <details className="md:col-span-2 lg:col-span-6 rounded-xl border border-slate-200 bg-slate-50/60">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-700">
            More options
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Textarea
            name="internalNotes"
            label="References"
          />
        </div>

        {canUploadFiles && (
          <div className="md:col-span-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
              <Paperclip className="h-4 w-4" /> Add Attachment
              <input
                name="attachments"
                type="file"
                multiple
                className="hidden"
              />
            </label>
          </div>
        )}

        <div className="md:col-span-2">
          <SubtaskBuilder employees={employees} />
        </div>

        <div className="md:col-span-2">
          <ChecklistBuilder />
        </div>

        <div className="md:col-span-2">
          <DependencySelector tasks={availableTasks} />
        </div>
          </div>
        </details>

        <div className="md:col-span-2 lg:col-span-6 flex justify-end gap-2 border-t border-slate-200 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Task
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">
          Core Task Details
        </p>
      </div>

      <Input
        name="title"
        label="Task Title"
        required
        defaultValue={task?.title ?? ''}
      />

      <Select
        name="priority"
        label="Priority"
        value={selectedPriority}
        onChange={(
          value,
        ) =>
          setSelectedPriority(
            value as Priority,
          )
        }
      >
        {meta.priorities.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </Select>

      <Select
        name="clientId"
        label="Client"
        required
        value={selectedClientId}
        onChange={handleClientChange}
      >
        <option value="">Select Client</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </Select>

      <div>
        <Select
          name="projectId"
          label="Existing Project"
          required
          value={selectedProjectId}
          onChange={handleProjectChange}
        >
          <option value="">Select Existing Project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {getProjectLabel(project)}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-slate-500">
          Create the project first, then add as many tasks as required.
        </p>
      </div>

      <Select
        name="departmentId"
        label="Department"
        defaultValue={task?.departmentId ?? ''}
      >
        <option value="">No Department</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </Select>

      {task ? (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Status
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="font-semibold text-slate-800">
              {task.status.name}
            </span>
          </div>
        </div>
      ) : (
        <Select
          name="statusId"
          label="Status"
          defaultValue={meta.statuses[0]?.id ?? ''}
        >
          {meta.statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </Select>
      )}

      <Input
        name="dueAt"
        label="Deadline"
        type="date"
        defaultValue={toDateInput(task?.dueAt)}
      />

      {(!task || canAssignPeople) && (
        <Select
          name="primaryAssigneeId"
          label="Assign To"
          defaultValue={primaryAssignee}
        >
          <option value="">Select Assignee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
              {employee.username ? ` (@${employee.username})` : ''}
              {employee.designation ? ` — ${employee.designation}` : ''}
            </option>
          ))}
        </Select>
      )}

      <div className="sm:col-span-2">
        <Textarea
          name="description"
          label="Description"
          defaultValue={task?.description ?? ''}
        />
      </div>

      {(!task || canAssignPeople) && (
        <>
          <PeopleSelector
            title="Collaborators"
            name="collaboratorIds"
            employees={employees}
            checkedIds={
              task?.collaborators?.map((item) => item.employeeId) ?? []
            }
          />

          <div className="sm:col-span-2">
            <PeopleSelector
              title="Reviewer"
              name="reviewerIds"
              employees={reviewerOptions}
              checkedIds={
                task?.reviewers?.map((item) => item.employeeId) ?? []
              }
              emptyText="No eligible reviewers available."
            />
          </div>
        </>
      )}

      {!task && (
        <>
          <div className="sm:col-span-2 mt-2 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-violet-700" />
              <p className="text-sm font-bold text-violet-950">
                Work Breakdown
              </p>
            </div>
            <p className="mt-1 text-xs text-violet-700">
              Add checklist items and assignable subtasks now. They remain editable from Task View.
            </p>
          </div>

          <div className="sm:col-span-2">
            <ChecklistBuilder />
          </div>

          <div className="sm:col-span-2">
            <SubtaskBuilder employees={employees} />
          </div>

          <div className="sm:col-span-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Tags className="h-4 w-4" /> Tags
              </span>
              <input
                name="tagNames"
                list="task-tag-suggestions"
                placeholder="Design, urgent-client, social-media"
                className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-400"
              />
              <datalist id="task-tag-suggestions">
                {extraOptions.tags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
              <p className="mt-1.5 text-xs text-slate-500">
                Separate multiple tags with commas.
              </p>
            </label>
          </div>

          <div className="sm:col-span-2">
            <DependencySelector tasks={availableTasks} />
          </div>

          {canUploadFiles && (
            <div className="sm:col-span-2">
              <CreateTaskVoiceInput />
            </div>
          )}

          {canUploadFiles && (
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Paperclip className="h-4 w-4" /> Initial Attachments
                </span>
                <input
                  name="attachments"
                  type="file"
                  multiple
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Files are uploaded after the task is created. Maximum 50 MB per file; backend file-type rules still apply.
                </p>
              </label>
            </div>
          )}

          <div className="sm:col-span-2">
            <RecurringTaskBuilder />
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <Textarea
          name="internalNotes"
          label="Internal Notes"
          defaultValue={task?.internalNotes ?? ''}
        />
      </div>

      <div className="flex flex-wrap gap-5 sm:col-span-2 rounded-xl border border-slate-200 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="isDraft"
            defaultChecked={task?.isDraft ?? false}
          />
          Save as Draft
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-red-700">
          <input
            type="checkbox"
            name="isCritical"
            defaultChecked={task?.isCritical ?? criticalDefault}
          />
          Critical Task
        </label>

        {!task && (
          <label className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <input
              type="checkbox"
              name="notifyAssignee"
              defaultChecked
            />
            Notify Assignee
          </label>
        )}
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {task ? 'Save Changes' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}


function CreateTaskVoiceInput() {
  const { authFetch } = useAuth();

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcriptLanguage, setTranscriptLanguage] = useState('gu');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('gu');
  const [transcriptMeta, setTranscriptMeta] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const inputRef = useRef<HTMLInputElement | null>(null);
  const transcriptRef = useRef<HTMLTextAreaElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyFileToInput = useCallback((file: File | null) => {
    const input = inputRef.current;
    if (!input) return;

    if (!file) {
      input.value = '';
      return;
    }

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    } catch {
      // Browser may block programmatic FileList assignment.
    }
  }, []);

  const setVoiceFile = useCallback(
    (
      file: File | null,
      duration: number | null = null,
    ) => {
      setSelectedFile(file);
      setDurationSeconds(duration);
      applyFileToInput(file);
      setVoiceError('');
    },
    [applyFileToInput],
  );

  const transcribeFile = useCallback(
    async (
      file: File,
      mode: 'replace' | 'append' = 'replace',
    ) => {
      setTranscribing(true);
      setVoiceError('');
      setTranscriptMeta('');

      try {
        const previewForm = new FormData();
        previewForm.append('file', file);
        if (transcriptionLanguage !== 'auto') {
          previewForm.append('language', transcriptionLanguage);
        }

        const response = await authFetch(
          '/voice-notes/preview-transcribe',
          {
            method: 'POST',
            body: previewForm,
          },
        );

        let result: unknown = null;

        try {
          result = await response.json();
        } catch {}

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              result,
              'Unable to transcribe this audio.',
            ),
          );
        }

        const payload = (result ?? {}) as {
          text?: string;
          language?: string | null;
          durationSeconds?: number | null;
          model?: string | null;
        };

        const nextText = payload.text?.trim() ?? '';

        if (mode === 'append' && nextText) {
          setTranscript((current) =>
            current.trim()
              ? `${current.trimEnd()}\n${nextText}`
              : nextText,
          );
        } else {
          setTranscript(nextText);
        }

        setTranscriptLanguage(
          payload.language?.trim() ||
            (transcriptionLanguage !== 'auto'
              ? transcriptionLanguage
              : ''),
        );

        const meta: string[] = [];

        if (payload.language) {
          meta.push(`Language: ${payload.language}`);
        }

        if (
          typeof payload.durationSeconds === 'number' &&
          Number.isFinite(payload.durationSeconds)
        ) {
          meta.push(
            `Audio: ${formatDuration(
              Math.max(0, Math.round(payload.durationSeconds)),
            )}`,
          );
        }

        if (payload.model) {
          meta.push(`Model: ${payload.model}`);
        }

        setTranscriptMeta(meta.join(' · '));
      } catch (error) {
        setVoiceError(
          error instanceof Error
            ? error.message
            : 'Unable to transcribe this audio.',
        );
      } finally {
        setTranscribing(false);
      }
    },
    [authFetch, transcriptionLanguage],
  );

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  useEffect(() => {
    const area = transcriptRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 112)}px`;
  }, [transcript]);

  useEffect(() => {
    return () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {}
      }
      stopStream();
    };
  }, [clearTimer, stopStream]);

  const startRecording = async () => {
    setVoiceError('');

    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setVoiceError(
        'Microphone recording is not supported in this browser. Please upload an audio file instead.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType =
        candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearTimer();

        const seconds = startedAtRef.current
          ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
          : Math.max(1, recordingSeconds);

        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const extension = finalMime.includes('ogg')
          ? 'ogg'
          : finalMime.includes('mp4')
            ? 'm4a'
            : 'webm';

        const file = new File(
          [new Blob(chunksRef.current, { type: finalMime })],
          `task-instruction-${Date.now()}.${extension}`,
          { type: finalMime },
        );

        setVoiceFile(file, Math.min(600, seconds));
        setRecording(false);
        startedAtRef.current = null;
        stopStream();

        void transcribeFile(file, 'append');
      };

      recorder.onerror = () => {
        setVoiceError('Recording failed. Please try again.');
        clearTimer();
        setRecording(false);
        stopStream();
      };

      setRecordingSeconds(0);
      setRecording(true);
      startedAtRef.current = Date.now();
      recorder.start(500);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((current) => {
          const next = current + 1;
          if (next >= 600) {
            setTimeout(() => finishRecording(), 0);
          }
          return next;
        });
      }, 1000);
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? error.message
          : 'Microphone permission was not granted.',
      );
      setRecording(false);
      clearTimer();
      stopStream();
    }
  };

  const removeSelection = () => {
    setSelectedFile(null);
    setDurationSeconds(null);
    setRecordingSeconds(0);
    applyFileToInput(null);
    setVoiceError('');
    setTranscriptMeta('');
  };

  return (
    <div className="rounded-lg">
      {voiceError && (
        <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {voiceError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recording ? finishRecording : () => void startRecording()}
          disabled={transcribing}
          className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
            recording
              ? 'bg-red-600 text-white'
              : 'bg-slate-900 text-white'
          }`}
        >
          {recording ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {recording
            ? `Stop ${formatDuration(recordingSeconds)}`
            : 'Record Voice'}
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700">
          <Upload className="h-3.5 w-3.5" /> Upload Audio
          <input
            ref={inputRef}
            name="voiceNote"
            type="file"
            accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a,.mp4,.aac"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) return;
              setVoiceFile(file, null);
              setTranscript('');
              setTranscriptLanguage('');
              void transcribeFile(file, 'replace');
            }}
            className="hidden"
          />
        </label>

        {transcribing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Transcribing…
          </span>
        )}

        {selectedFile && (
          <button
            type="button"
            onClick={removeSelection}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-red-600"
            title="Remove voice note"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>

      <input
        type="hidden"
        name="voiceDurationSeconds"
        value={durationSeconds ?? ''}
        readOnly
      />

      <input
        type="hidden"
        name="voiceTranscriptLanguage"
        value={transcriptLanguage}
        readOnly
      />

      {(selectedFile || transcript || recording || transcribing) && (
        <div className="mt-2 flex items-start gap-2">
          {selectedFile && previewUrl && (
            <audio controls src={previewUrl} className="h-8 w-44 shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <textarea
              ref={transcriptRef}
              name="voiceTranscript"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={1}
              placeholder={
                recording
                  ? 'Listening…'
                  : transcribing
                    ? 'Transcribing…'
                    : 'Transcript'
              }
              className="max-h-28 min-h-9 w-full resize-none overflow-y-auto rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-indigo-300"
            />
          </div>
        </div>
      )}
    </div>
  );

}

function ChecklistBuilder() {
  const [rows, setRows] = useState(['']);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">Checklist</p>
        <button
          type="button"
          onClick={() => setRows((items) => [...items, ''])}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Add Item
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-2">
            <input
              name="checklistItem"
              value={row}
              onChange={(event) =>
                setRows((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
              placeholder={`Checklist item ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setRows((items) => items.filter((_, i) => i !== index))
                }
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubtaskBuilder({ employees }: { employees: Employee[] }) {
  const [rows, setRows] = useState([
    { title: '', assignedEmployeeId: '' },
  ]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">Subtasks</p>
        <button
          type="button"
          onClick={() =>
            setRows((items) => [
              ...items,
              { title: '', assignedEmployeeId: '' },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Add Subtask
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_260px_auto]"
          >
            <input
              name="subtaskTitle"
              value={row.title}
              onChange={(event) =>
                setRows((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder={`Subtask ${index + 1}`}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
            />

            <select
              name="subtaskAssigneeId"
              value={row.assignedEmployeeId}
              onChange={(event) =>
                setRows((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, assignedEmployeeId: event.target.value }
                      : item,
                  ),
                )
              }
              className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setRows((items) => items.filter((_, i) => i !== index))
                }
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DependencySelector({ tasks }: { tasks: DependencyOption[] }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Link2 className="h-4 w-4" /> Dependencies
      </p>
      <div className="max-h-20 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
        {tasks.map((task) => (
          <label
            key={task.id}
            className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              name="dependencyIds"
              value={task.id}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                {task.title}
              </span>
              <span className="text-xs text-slate-500">
                {task.client.name} · {task.project.name} · {task.status.name}
              </span>
            </span>
          </label>
        ))}
        {!tasks.length && (
          <p className="p-3 text-sm text-slate-400">No dependency tasks available.</p>
        )}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        New dependencies use Finish-to-Start by default.
      </p>
    </div>
  );
}

function RecurringTaskBuilder() {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState('WEEKLY');

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <input
          type="checkbox"
          name="recurringEnabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <Repeat2 className="h-4 w-4" /> Recurring Task
      </label>

      {enabled && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Frequency</span>
            <select
              name="recurrenceFrequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </label>

          <Input
            name="recurrenceInterval"
            label="Repeat Every"
            type="number"
            defaultValue="1"
          />

          <Input
            name="recurrenceStartAt"
            label="Recurring Start"
            type="datetime-local"
          />

          <Input
            name="recurrenceEndAt"
            label="Recurring End (Optional)"
            type="datetime-local"
          />

          {frequency === 'WEEKLY' && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-bold text-slate-600">Weekdays</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ['Sun', 0],
                  ['Mon', 1],
                  ['Tue', 2],
                  ['Wed', 3],
                  ['Thu', 4],
                  ['Fri', 5],
                  ['Sat', 6],
                ].map(([label, value]) => (
                  <label
                    key={String(value)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold"
                  >
                    <input
                      type="checkbox"
                      name="recurrenceWeekdays"
                      value={String(value)}
                    />
                    {String(label)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {frequency === 'MONTHLY' && (
            <Input
              name="recurrenceDayOfMonth"
              label="Day of Month"
              type="number"
              defaultValue="1"
            />
          )}
        </div>
      )}
    </div>
  );
}

function TaskDetails({
  task,
}: {
  task: Task;
}) {
  const primary =
    task.assignees.find(
      (person) =>
        person.isPrimary,
    ) ?? task.assignees[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          status={task.status}
        />

        <PriorityBadge
          priority={
            task.priority
          }
        />

        {task.isDraft && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
            DRAFT
          </span>
        )}

        {task.isCritical && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            CRITICAL
          </span>
        )}
      </div>

      {task.description && (
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Brief
          </h3>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {task.description}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DetailCard
          label="Client"
          value={
            task.client.name
          }
        />

        <DetailCard
          label="Project"
          value={
            task.project.name
          }
        />

        <DetailCard
          label="Assigned To"
          value={
            primary?.employee
              .fullName ?? '—'
          }
        />



        <DetailCard
          label="Department"
          value={task.department?.name ?? '—'}
        />

        <DetailCard
          label="Start Date"
          value={formatDateTime(
            task.startDate,
          )}
        />

        <DetailCard
          label="Due"
          value={formatDateOnly(task.dueAt)}
        />



      </div>

      {!!task.collaborators
        ?.length && (
        <PeopleSummary
          title="Collaborators"
          people={
            task.collaborators
          }
        />
      )}

      {!!task.reviewers?.length && (
        <ReviewerApprovalSummary task={task} />
      )}

      {task.internalNotes && (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            References
          </p>

          <p className="mt-2 text-sm text-amber-900">
            {task.internalNotes}
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewerApprovalSummary({
  task,
}: {
  task: Task;
}) {
  const latestByReviewer =
    new Map<string, TaskApproval>();

  for (const approval of task.approvals ?? []) {
    if (
      approval.reviewerId &&
      !latestByReviewer.has(
        approval.reviewerId,
      )
    ) {
      latestByReviewer.set(
        approval.reviewerId,
        approval,
      );
    }
  }

  const getLabel = (
    status?: TaskApproval['status'],
  ) => {
    switch (status) {
      case 'APPROVED':
        return 'Approved';
      case 'CHANGES_REQUESTED':
        return 'Changes Requested';
      case 'REJECTED':
        return 'Rejected';
      case 'CANCELLED':
        return 'Closed';
      case 'PENDING':
        return 'Pending';
      default:
        return 'Not Submitted';
    }
  };

  const getClassName = (
    status?: TaskApproval['status'],
  ) => {
    switch (status) {
      case 'APPROVED':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'CHANGES_REQUESTED':
      case 'REJECTED':
        return 'border-rose-200 bg-rose-50 text-rose-700';
      case 'PENDING':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        Reviewers
      </p>

      <div className="mt-3 space-y-2">
        {task.reviewers?.map((person) => {
          const approval =
            latestByReviewer.get(
              person.employeeId,
            );

          return (
            <div
              key={person.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {person.employee.fullName}
                </p>

                {person.employee.designation && (
                  <p className="text-xs text-slate-500">
                    {person.employee.designation}
                  </p>
                )}
              </div>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${getClassName(
                  approval?.status,
                )}`}
              >
                {getLabel(
                  approval?.status,
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function TaskExtrasPanel({
  task,
  employees,
  canManage,
  canUpdate,
  onChanged,
}: {
  task: Task;
  employees: Employee[];
  canManage: boolean;
  canUpdate: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [options, setOptions] = useState<TaskExtraOptions>({
    tags: [],
    dependencyTasks: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskAssignee, setNewSubtaskAssignee] = useState('');
  const [newChecklist, setNewChecklist] = useState('');
  const [tagText, setTagText] = useState(
    (task.tags ?? []).map((item) => item.tag.name).join(', '),
  );
  const [dependencyIds, setDependencyIds] = useState<string[]>(
    (task.dependencies ?? []).map((item) => item.dependsOnTaskId),
  );

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await authFetch(path, init);
      let data: unknown = null;
      try { data = await response.json(); } catch {}
      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Request failed.'));
      }
      return data as T;
    },
    [authFetch],
  );

  useEffect(() => {
    setTagText(
      (task.tags ?? []).map((item) => item.tag.name).join(', '),
    );
    setDependencyIds(
      (task.dependencies ?? []).map((item) => item.dependsOnTaskId),
    );
  }, [task]);

  useEffect(() => {
    if (!canManage) return;
    void request<TaskExtraOptions>(
      `/task-extras/options?taskId=${task.id}`,
    )
      .then(setOptions)
      .catch(() => {});
  }, [canManage, request, task.id]);

  async function mutate(path: string, init: RequestInit) {
    setBusy(true);
    setError('');
    try {
      await request(path, init);
      await onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update task.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    await mutate(`/subtasks/task/${task.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newSubtask.trim(),
        assignedEmployeeId: newSubtaskAssignee || undefined,
      }),
    });
    setNewSubtask('');
    setNewSubtaskAssignee('');
  }

  async function editSubtask(item: SubtaskRecord) {
    const title = window.prompt('Subtask title:', item.title);
    if (title === null || !title.trim()) return;
    const description = window.prompt(
      'Subtask description (optional):',
      item.description ?? '',
    );
    if (description === null) return;

    await mutate(`/subtasks/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description,
        assignedEmployeeId: item.assignedEmployeeId || undefined,
      }),
    });
  }

  async function addChecklist() {
    if (!newChecklist.trim()) return;
    await mutate(`/checklists/task/${task.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newChecklist.trim() }),
    });
    setNewChecklist('');
  }

  async function editChecklist(item: ChecklistRecord) {
    const title = window.prompt('Checklist item:', item.title);
    if (title === null || !title.trim()) return;
    await mutate(`/checklists/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
  }

  async function saveTags() {
    const names = tagText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    await mutate(`/task-extras/task/${task.id}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });
  }

  async function saveDependencies() {
    await mutate(`/task-extras/task/${task.id}/dependencies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskIds: dependencyIds,
        type: 'FINISH_TO_START',
      }),
    });
  }

  const completedSubtasks = (task.subtasks ?? []).filter(
    (item) => item.isCompleted,
  ).length;
  const completedChecklist = (task.checklist ?? []).filter(
    (item) => item.isCompleted,
  ).length;

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
            <ListChecks className="h-5 w-5" /> Work Breakdown
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Subtasks {completedSubtasks}/{task.subtasks?.length ?? 0} · Checklist {completedChecklist}/{task.checklist?.length ?? 0}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-slate-900">Subtasks</p>
            <span className="text-xs text-slate-400">
              {task.subtasks?.length ?? 0} items
            </span>
          </div>

          <div className="space-y-2">
            {(task.subtasks ?? []).map((item) => {
              const employee = employees.find(
                (person) => person.id === item.assignedEmployeeId,
              );
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    disabled={!canUpdate || busy}
                    onChange={(event) =>
                      void mutate(`/subtasks/${item.id}/complete`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isCompleted: event.target.checked }),
                      })
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {employee?.fullName ?? 'Unassigned'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void editSubtask(item)}
                        aria-label="Edit subtask"
                        className="rounded-lg border border-slate-200 p-2 text-slate-500"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm('Delete this subtask?')) return;
                          void mutate(`/subtasks/${item.id}`, { method: 'DELETE' });
                        }}
                        aria-label="Delete subtask"
                        className="rounded-lg border border-slate-200 p-2 text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {!task.subtasks?.length && (
              <p className="py-5 text-center text-sm text-slate-400">No subtasks yet.</p>
            )}
          </div>

          {canManage && (
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              <input
                value={newSubtask}
                onChange={(event) => setNewSubtask(event.target.value)}
                placeholder="New subtask"
                aria-label="New subtask title"
                className="min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:col-span-2"
              />
              <select
                value={newSubtaskAssignee}
                onChange={(event) => setNewSubtaskAssignee(event.target.value)}
                aria-label="Subtask assignee"
                className="min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="">Unassigned</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !newSubtask.trim()}
                onClick={() => void addSubtask()}
                className="w-full whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Subtask
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-slate-900">Checklist</p>
            <span className="text-xs text-slate-400">
              {task.checklist?.length ?? 0} items
            </span>
          </div>

          <div className="space-y-2">
            {(task.checklist ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"
              >
                <input
                  type="checkbox"
                  checked={item.isCompleted}
                  disabled={!canUpdate || busy}
                  onChange={(event) =>
                    void mutate(`/checklists/${item.id}/complete`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ isCompleted: event.target.checked }),
                    })
                  }
                  className="mt-1"
                />
                <p className={`min-w-0 flex-1 text-sm font-semibold ${item.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {item.title}
                </p>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void editChecklist(item)}
                      aria-label="Edit checklist item"
                      className="rounded-lg border border-slate-200 p-2 text-slate-500"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm('Delete this checklist item?')) return;
                        void mutate(`/checklists/${item.id}`, { method: 'DELETE' });
                      }}
                      aria-label="Delete checklist item"
                      className="rounded-lg border border-slate-200 p-2 text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!task.checklist?.length && (
              <p className="py-5 text-center text-sm text-slate-400">No checklist items yet.</p>
            )}
          </div>

          {canManage && (
            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={newChecklist}
                onChange={(event) => setNewChecklist(event.target.value)}
                placeholder="New checklist item"
                aria-label="New checklist item"
                className="min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <button
                type="button"
                disabled={busy || !newChecklist.trim()}
                onClick={() => void addChecklist()}
                className="w-full whitespace-nowrap rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                Add Item
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Tags className="h-4 w-4" /> Tags
          </p>

          {canManage ? (
            <div className="flex gap-2">
              <input
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                list={`tag-options-${task.id}`}
                placeholder="Design, urgent-client"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <datalist id={`tag-options-${task.id}`}>
                {options.tags.map((tag) => (
                  <option key={tag.id} value={tag.name} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveTags()}
                className="rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(task.tags ?? []).map((item) => (
                <span key={item.id} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                  {item.tag.name}
                </span>
              ))}
              {!task.tags?.length && <span className="text-sm text-slate-400">No tags.</span>}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Link2 className="h-4 w-4" /> Dependencies
          </p>

          {canManage ? (
            <>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {options.dependencyTasks.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-start gap-2 rounded-lg p-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={dependencyIds.includes(option.id)}
                      onChange={(event) =>
                        setDependencyIds((items) =>
                          event.target.checked
                            ? [...new Set([...items, option.id])]
                            : items.filter((id) => id !== option.id),
                        )
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{option.title}</span>
                      <span className="text-xs text-slate-400">{option.project.name} · {option.status.name}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveDependencies()}
                className="mt-2 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white"
              >
                Save Dependencies
              </button>
            </>
          ) : (
            <div className="space-y-2">
              {(task.dependencies ?? []).map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                  <span className="font-semibold">{item.dependsOn.title}</span>
                  <span className="ml-2 text-xs text-slate-400">{item.dependsOn.status.name}</span>
                </div>
              ))}
              {!task.dependencies?.length && <span className="text-sm text-slate-400">No dependencies.</span>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PeopleSummary({
  title,
  people,
}: {
  title: string;
  people: TaskPerson[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold">
        {title}
      </h3>

      <div className="flex flex-wrap gap-2">
        {people.map(
          (person) => (
            <span
              key={person.id}
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {
                person.employee
                  .fullName
              }
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function PeopleSelector({
  title,
  name,
  employees,
  checkedIds,
  emptyText = 'No employees found.',
}: {
  title: string;
  name: string;
  employees: Employee[];
  checkedIds: string[];
  emptyText?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>

      <div className="grid max-h-24 gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 sm:grid-cols-2">
        {employees.map(
          (employee) => (
            <label
              key={employee.id}
              className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name={name}
                value={employee.id}
                defaultChecked={checkedIds.includes(
                  employee.id,
                )}
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {employee.fullName}
                  {employee.username
                    ? ` (@${employee.username})`
                    : ''}
                </p>

                {employee.designation && (
                  <p className="truncate text-[11px] leading-4 text-slate-400">
                    {
                      employee.designation
                    }
                  </p>
                )}
              </div>
            </label>
          ),
        )}

        {!employees.length && (
          <p className="p-3 text-sm text-slate-400">
            {emptyText}
          </p>
        )}
      </div>
    </div>
  );
}

function Modal({
  title,
  error,
  children,
  onClose,
}: {
  title: string;
  error: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-x-hidden overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-xl font-bold text-slate-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4">
          {error && (
            <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required = false,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        min={
          type === 'number'
            ? 0
            : undefined
        }
        step={
          type === 'number'
            ? 'any'
            : undefined
        }
        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Select({
  name,
  label,
  defaultValue,
  value,
  onChange,
  required = false,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (
    value: string,
  ) => void;
  required?: boolean;
  children: ReactNode;
}) {
  const controlled =
    value !== undefined;

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <select
        name={name}
        required={required}
        {...(controlled
          ? {
              value,
              onChange: (
                event: React.ChangeEvent<HTMLSelectElement>,
              ) =>
                onChange?.(
                  event.target
                    .value,
                ),
            }
          : {
              defaultValue,
            })}
        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-400"
      >
        {children}
      </select>
    </label>
  );
}

function AutoGrowTextarea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <textarea
        name={name}
        rows={1}
        defaultValue={defaultValue}
        onInput={(event) => {
          const element = event.currentTarget;
          element.style.height = '36px';
          element.style.height = `${Math.max(36, element.scrollHeight)}px`;
        }}
        className="min-h-9 max-h-32 w-full resize-none overflow-y-auto rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Textarea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <textarea
        name={name}
        rows={2}
        defaultValue={defaultValue}
        className="w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  const styles: Record<
    Priority,
    string
  > = {
    LOW:
      'bg-slate-100 text-slate-600',

    MEDIUM:
      'bg-blue-50 text-blue-700',

    HIGH:
      'bg-orange-50 text-orange-700',

    URGENT:
      'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[priority]}`}
    >
      <Flag className="h-3 w-3" />
      {priority}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: TaskStatus;
}) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
      {status.name}
    </span>
  );
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDateTime(
  value?: string | null,
) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return date.toLocaleString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function toDateInput(
  value?: string | null,
) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

function formatDateOnly(
  value?: string | null,
) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function toDateTimeInput(
  value?: string | null,
) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  const pad = (
    number: number,
  ) =>
    String(number).padStart(
      2,
      '0',
    );

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(
    date.getDate(),
  )}T${pad(
    date.getHours(),
  )}:${pad(
    date.getMinutes(),
  )}`;
}

function normalizeDateTime(
  value: string,
) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return date.toISOString();
}

function isOverdue(
  task: Task,
) {
  if (!task.dueAt) {
    return false;
  }

  if (
    [
      'DONE',
      'COMPLETED',
      'CANCELLED',
      'ARCHIVED',
    ].includes(
      task.status.code,
    )
  ) {
    return false;
  }

  return (
    new Date(task.dueAt) <
    new Date()
  );
}


