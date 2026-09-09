'use client';

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Flag,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { useSearchParams } from 'next/navigation';
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
  client?: Client;
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
  internalNotes?: string | null;

  isDraft: boolean;
  isCritical: boolean;

  createdAt: string;
  updatedAt: string;

  client: Client;
  project: Project;

  status: TaskStatus;
  category?: TaskCategory | null;

  assignees: TaskPerson[];

  collaborators?: TaskPerson[];
  reviewers?: TaskPerson[];

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
  } = useAuth();

  const searchParams = useSearchParams();

const criticalMode =
  searchParams.get('critical') === '1';

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

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

const canReview =
  hasPermission('tasks.review');

const canApprove =
  hasPermission('tasks.approve');

const canDelete =
  hasPermission('tasks.delete');

  const canViewEmployees =
  hasPermission('employees.view');

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
    criticalMode &&
    canCreate
  ) {
    setSelectedTask(null);
    setModal('create');
  }
}, [
  criticalMode,
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
  : Promise.resolve({
      data: [],
    } as any),
        ]);

        setMeta(taskMeta);

        setClients(
          unwrapList<Client>(
            clientResult,
          ),
        );

        setProjects(
          unwrapList<Project>(
            projectResult,
          ),
        );

        setEmployees(
          unwrapList<Employee>(
            employeeResult,
          ),
        );
      } catch (err) {
        console.error(err);
      }
    }, [
  request,
  canViewEmployees,
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

  const stats = useMemo(() => {
    const now = new Date();

    return {
      total: tasks.length,

      active:
        tasks.filter((task) =>
          [
            'IN_PROGRESS',
            'ACTIVE',
          ].includes(
            task.status.code,
          ),
        ).length,

      completed:
        tasks.filter((task) =>
          [
            'DONE',
            'COMPLETED',
          ].includes(
            task.status.code,
          ),
        ).length,

      overdue:
        tasks.filter((task) => {
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
            now
          );
        }).length,
    };
  }, [tasks]);

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

    const formElement =
      event.currentTarget;

    const form =
      new FormData(formElement);

    const assigneeIds =
      form
        .getAll('assigneeIds')
        .map(String);

    const collaboratorIds =
      form
        .getAll(
          'collaboratorIds',
        )
        .map(String);

    const reviewerIds =
      form
        .getAll('reviewerIds')
        .map(String);

    const primaryAssigneeId =
      String(
        form.get(
          'primaryAssigneeId',
        ) ?? '',
      );

    const estimatedHours =
      String(
        form.get(
          'estimatedHours',
        ) ?? '',
      ).trim();

    setSaving(true);
    setError('');

    try {
      await request('/tasks', {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          title: String(
            form.get('title') ?? '',
          ),

          description:
            String(
              form.get(
                'description',
              ) ?? '',
            ) || undefined,

          clientId: String(
            form.get('clientId') ??
              '',
          ),

          projectId: String(
            form.get('projectId') ??
              '',
          ),

          categoryId:
            String(
              form.get(
                'categoryId',
              ) ?? '',
            ) || undefined,

          statusId:
            String(
              form.get('statusId') ??
                '',
            ) || undefined,

          priority: String(
            form.get('priority') ??
              'MEDIUM',
          ),

          startDate:
            String(
              form.get(
                'startDate',
              ) ?? '',
            ) || undefined,

          dueAt:
            normalizeDateTime(
              String(
                form.get('dueAt') ??
                  '',
              ),
            ) || undefined,

          estimatedHours:
            estimatedHours
              ? Number(
                  estimatedHours,
                )
              : undefined,

          internalNotes:
            String(
              form.get(
                'internalNotes',
              ) ?? '',
            ) || undefined,

          isDraft:
            form.get('isDraft') ===
            'on',

          isCritical:
            form.get(
              'isCritical',
            ) === 'on',

          primaryAssigneeId:
            primaryAssigneeId ||
            undefined,

          assigneeIds,

          collaboratorIds,

          reviewerIds,
        }),
      });

      closeModal();

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Task creation failed.',
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

    const estimatedHours =
      String(
        form.get(
          'estimatedHours',
        ) ?? '',
      ).trim();

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

            categoryId:
              String(
                form.get(
                  'categoryId',
                ) ?? '',
              ) || null,

           priority: String(
              form.get('priority') ??
                'MEDIUM',
            ),

            startDate:
              String(
                form.get(
                  'startDate',
                ) ?? '',
              ) || null,

            dueAt:
              normalizeDateTime(
                String(
                  form.get(
                    'dueAt',
                  ) ?? '',
                ),
              ) || null,

            estimatedHours:
              estimatedHours
                ? Number(
                    estimatedHours,
                  )
                : null,

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
          <p className="text-sm font-semibold text-violet-700">
            Work Management
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Tasks
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Assign, track and
            manage daily work from
            one place.
          </p>
        </div>

        <div className="flex gap-2">
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Total Tasks"
          value={stats.total}
        />

        <StatCard
          icon={Clock3}
          label="In Progress"
          value={stats.active}
        />

        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={
            stats.completed
          }
        />

        <StatCard
          icon={AlertTriangle}
          label="Overdue"
          value={stats.overdue}
        />
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
  saving={saving}
  onSubmit={createTask}
  criticalDefault={criticalMode}
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
  saving,
  onSubmit,
  criticalDefault = false,
}: {
  task?: Task;
  meta: TaskMeta;
  clients: Client[];
  projects: Project[];
  employees: Employee[];
  saving: boolean;
  

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
   criticalDefault?: boolean;
}) {
  const [
    selectedClientId,
    setSelectedClientId,
  ] = useState(
    task?.clientId ?? '',
  );

  const [
    selectedProjectId,
    setSelectedProjectId,
  ] = useState(
    task?.projectId ?? '',
  );

  const getProjectClientId = (
    project: Project,
  ) =>
    project.clientId ??
    project.client?.id ??
    '';

  const handleClientChange = (
    value: string,
  ) => {
    setSelectedClientId(value);

    if (!selectedProjectId) {
      return;
    }

    const selectedProject =
      projects.find(
        (project) =>
          project.id ===
          selectedProjectId,
      );

    if (!selectedProject) {
      setSelectedProjectId('');
      return;
    }

    const projectClientId =
      getProjectClientId(
        selectedProject,
      );

    if (
      value &&
      projectClientId &&
      projectClientId !== value
    ) {
      setSelectedProjectId('');
    }
  };

  const handleProjectChange = (
    value: string,
  ) => {
    setSelectedProjectId(value);

    if (!value) {
      return;
    }

    const selectedProject =
      projects.find(
        (project) =>
          project.id === value,
      );

    if (!selectedProject) {
      return;
    }

    const projectClientId =
      getProjectClientId(
        selectedProject,
      );

    if (projectClientId) {
      setSelectedClientId(
        projectClientId,
      );
    }
  };

  const getProjectLabel = (
    project: Project,
  ) => {
    const projectClientId =
      getProjectClientId(project);

    const clientName =
      project.client?.name ??
      clients.find(
        (client) =>
          client.id ===
          projectClientId,
      )?.name;

    return clientName
      ? `${project.name} — ${clientName}`
      : project.name;
  };

  const primaryAssignee =
    task?.assignees.find(
      (item) =>
        item.isPrimary,
    )?.employeeId ??
    task?.assignees[0]
      ?.employeeId ??
    '';

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Input
        name="title"
        label="Task Title"
        required
        defaultValue={
          task?.title ?? ''
        }
      />

      <Select
        name="priority"
        label="Priority"
        defaultValue={
          task?.priority ??
          'MEDIUM'
        }
      >
        {meta.priorities.map(
          (priority) => (
            <option
              key={priority}
              value={priority}
            >
              {priority}
            </option>
          ),
        )}
      </Select>

      <Select
        name="clientId"
        label="Client"
        required
        value={selectedClientId}
        onChange={
          handleClientChange
        }
      >
        <option value="">
          Select Client
        </option>

        {clients.map(
          (client) => (
            <option
              key={client.id}
              value={client.id}
            >
              {client.name}
            </option>
          ),
        )}
      </Select>

      <div>
        <Select
          name="projectId"
          label="Existing Project"
          required
          value={selectedProjectId}
          onChange={
            handleProjectChange
          }
        >
          <option value="">
            Select Existing Project
          </option>

          {projects.map(
            (project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {getProjectLabel(
                  project,
                )}
              </option>
            ),
          )}
        </Select>

        <p className="mt-1.5 text-xs text-slate-500">
          Select an existing project.
          You can create multiple tasks
          under the same project.
        </p>

        {!projects.length && (
          <p className="mt-1.5 text-xs font-medium text-amber-700">
            No existing projects found.
            Create a project first.
          </p>
        )}
      </div>
      {task ? (
  <div>
    <label className="mb-1.5 block text-sm font-medium text-slate-700">
      Status
    </label>

    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
      <span className="font-semibold text-slate-800">
        {task.status.name}
      </span>

      <span className="ml-2 text-xs text-slate-500">
        Workflow controlled
      </span>
    </div>
  </div>
) : (
  <Select
    name="statusId"
    label="Status"
    defaultValue={
      meta.statuses[0]?.id ?? ''
    }
  >
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
  </Select>
)}
       
      <Select
        name="categoryId"
        label="Category"
        defaultValue={
          task?.categoryId ?? ''
        }
      >
        <option value="">
          No Category
        </option>

        {meta.categories.map(
          (category) => (
            <option
              key={category.id}
              value={category.id}
            >
              {category.name}
            </option>
          ),
        )}
      </Select>

      <Input
        name="startDate"
        label="Start Date"
        type="date"
        defaultValue={toDateInput(
          task?.startDate,
        )}
      />

      <Input
        name="dueAt"
        label="Due Date & Time"
        type="datetime-local"
        defaultValue={toDateTimeInput(
          task?.dueAt,
        )}
      />

      <Input
        name="estimatedHours"
        label="Estimated Hours"
        type="number"
        defaultValue={
          task?.estimatedHours !=
          null
            ? String(
                task.estimatedHours,
              )
            : ''
        }
      />

      {!task && (
        <Select
          name="primaryAssigneeId"
          label="Primary Assignee"
          defaultValue=""
        >
          <option value="">
            Select Assignee
          </option>

          {employees.map(
            (employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.fullName}
                {employee.username
                  ? ` (@${employee.username})`
                  : ''}
                {employee.designation
                  ? ` — ${employee.designation}`
                  : ''}
              </option>
            ),
          )}
        </Select>
      )}

      <div className="sm:col-span-2">
        <Textarea
          name="description"
          label="Description"
          defaultValue={
            task?.description ?? ''
          }
        />
      </div>

      {!task && (
        <>
          <PeopleSelector
            title="Additional Assignees"
            name="assigneeIds"
            employees={employees}
            checkedIds={
              primaryAssignee
                ? [
                    primaryAssignee,
                  ]
                : []
            }
          />

          <PeopleSelector
            title="Collaborators"
            name="collaboratorIds"
            employees={employees}
            checkedIds={[]}
          />

          <div className="sm:col-span-2">
            <PeopleSelector
              title="Reviewers"
              name="reviewerIds"
              employees={
                employees
              }
              checkedIds={[]}
            />
          </div>
        </>
      )}

      <div className="sm:col-span-2">
        <Textarea
          name="internalNotes"
          label="Internal Notes"
          defaultValue={
            task?.internalNotes ??
            ''
          }
        />
      </div>

      <div className="flex flex-wrap gap-5 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            name="isDraft"
            defaultChecked={
              task?.isDraft ??
              false
            }
           
          />
          Save as Draft
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-red-700">
        <input
  type="checkbox"
  name="isCritical"
  defaultChecked={
    task?.isCritical ??
    criticalDefault
  }
/>
          Critical Task
        </label>
      </div>

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}

          {task
            ? 'Save Changes'
            : 'Create Task'}
        </button>
      </div>
    </form>
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
            Description
          </h3>

          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {task.description}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
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
          label="Primary Assignee"
          value={
            primary?.employee
              .fullName ?? '—'
          }
        />

        <DetailCard
          label="Category"
          value={
            task.category?.name ??
            '—'
          }
        />

        <DetailCard
          label="Start Date"
          value={formatDateTime(
            task.startDate,
          )}
        />

        <DetailCard
          label="Due"
          value={formatDateTime(
            task.dueAt,
          )}
        />

        <DetailCard
          label="Estimated Hours"
          value={
            task.estimatedHours !=
            null
              ? `${task.estimatedHours} hrs`
              : '—'
          }
        />

        <DetailCard
          label="Last Updated"
          value={formatDateTime(
            task.updatedAt,
          )}
        />
      </div>

      {task.assignees.length >
        0 && (
        <PeopleSummary
          title="Assignees"
          people={task.assignees}
        />
      )}

      {!!task.collaborators
        ?.length && (
        <PeopleSummary
          title="Collaborators"
          people={
            task.collaborators
          }
        />
      )}

      {!!task.reviewers
        ?.length && (
        <PeopleSummary
          title="Reviewers"
          people={
            task.reviewers
          }
        />
      )}

      {task.internalNotes && (
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Internal Notes
          </p>

          <p className="mt-2 text-sm text-amber-900">
            {task.internalNotes}
          </p>
        </div>
      )}
    </div>
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
}: {
  title: string;
  name: string;
  employees: Employee[];
  checkedIds: string[];
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">
        {title}
      </p>

      <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-2">
        {employees.map(
          (employee) => (
            <label
              key={employee.id}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name={name}
                value={employee.id}
                defaultChecked={checkedIds.includes(
                  employee.id,
                )}
              />

              <div>
                <p className="text-sm font-semibold">
                  {employee.fullName}
                  {employee.username
                    ? ` (@${employee.username})`
                    : ''}
                </p>

                {employee.designation && (
                  <p className="text-xs text-slate-400">
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
            No employees found.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <h2 className="text-xl font-bold text-slate-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">
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
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">
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
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
      >
        {children}
      </select>
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
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <textarea
        name={name}
        rows={4}
        defaultValue={defaultValue}
        className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
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

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {value}
          </p>
        </div>

        <div className="rounded-xl bg-slate-100 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
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