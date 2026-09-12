'use client';

import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Columns3,
  GripVertical,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  useAuth,
} from '@/components/auth/auth-provider';
import { appDialog } from '@/components/ui/app-dialog-provider';

type ColumnCode =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'CHANGES_REQUESTED'
  | 'DONE';

type Person = {
  id: string;
  employeeId: string;
  username?: string | null;
  fullName: string;
  designation?: string | null;
  profileImageUrl?: string | null;
  isPrimary?: boolean;
};

type Card = {
  id: string;
  title: string;
  description?: string | null;
  priority:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'URGENT';
  dueAt?: string | null;
  estimatedHours: number;
  isCritical: boolean;
  status: {
    id: string;
    code: string;
    name: string;
    color?: string | null;
  };
  column: ColumnCode;
  client: {
    id: string;
    name: string;
    companyName?: string | null;
  };
  project: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
  } | null;
  category?: {
    id: string;
    name: string;
    color?: string | null;
  } | null;
  assignees: Person[];
  reviewers: Person[];
  subtaskProgress: {
    completed: number;
    total: number;
    percent: number;
  };
  attachmentCount: number;
  commentCount: number;
  loggedSeconds: number;
  loggedHours: number;
  isOverdue: boolean;
  updatedAt: string;
};

type BoardResponse = {
  columns: Record<
    ColumnCode,
    Card[]
  >;
  total: number;
  permissions: {
    canUpdate: boolean;
    canReview: boolean;
    canApprove: boolean;
    canReopen: boolean;
  };
};

type Options = {
  clients: Array<{
    id: string;
    name: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    clientId: string;
  }>;
  employees: Array<{
    id: string;
    fullName: string;
    username?: string | null;
    profileImageUrl?: string | null;
  }>;
  priorities: string[];
};

type Filters = {
  search: string;
  clientId: string;
  projectId: string;
  assigneeId: string;
  priority: string;
};

const emptyFilters: Filters = {
  search: '',
  clientId: '',
  projectId: '',
  assigneeId: '',
  priority: '',
};

const columnConfig: Array<{
  code: ColumnCode;
  label: string;
  hint: string;
  headerClass: string;
}> = [
  {
    code: 'TODO',
    label: 'To Do',
    hint: 'Ready to start',
    headerClass:
      'border-slate-200 bg-slate-100 text-slate-700',
  },
  {
    code: 'IN_PROGRESS',
    label: 'In Progress',
    hint: 'Work underway',
    headerClass:
      'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    code: 'REVIEW',
    label: 'Review',
    hint: 'Waiting for approval',
    headerClass:
      'border-violet-200 bg-violet-50 text-violet-700',
  },
  {
    code: 'CHANGES_REQUESTED',
    label: 'Changes Requested',
    hint: 'Needs correction',
    headerClass:
      'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    code: 'DONE',
    label: 'Done',
    hint: 'Approved & complete',
    headerClass:
      'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
];

function initials(
  name: string,
) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]?.toUpperCase() ??
        '',
    )
    .join('');
}

function hoursLabel(
  value: number,
) {
  return `${value.toFixed(
    2,
  )}h`;
}

function priorityClass(
  priority: Card['priority'],
) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-50 text-red-700 ring-red-100';
    case 'HIGH':
      return 'bg-orange-50 text-orange-700 ring-orange-100';
    case 'MEDIUM':
      return 'bg-blue-50 text-blue-700 ring-blue-100';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function messageFrom(
  value: unknown,
  fallback: string,
) {
  if (
    typeof value ===
      'object' &&
    value !== null &&
    'message' in value
  ) {
    const message =
      (
        value as {
          message?:
            | string
            | string[];
        }
      ).message;

    if (
      Array.isArray(
        message,
      )
    ) {
      return message.join(
        ', ',
      );
    }

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }
  }

  return fallback;
}

function TaskCard({
  card,
  onDragStart,
  onOpen,
  onReopen,
  busy,
  canReopen,
}: {
  card: Card;
  onDragStart: (
    event: DragEvent<HTMLDivElement>,
    card: Card,
  ) => void;
  onOpen: (
    card: Card,
  ) => void;
  onReopen: (
    card: Card,
  ) => void;
  busy: boolean;
  canReopen: boolean;
}) {
  const primary =
    card.assignees.find(
      (person) =>
        person.isPrimary,
    ) ??
    card.assignees[0];

  return (
    <div
      draggable={
        !busy
      }
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!busy) {
          onOpen(card);
        }
      }}
      onKeyDown={(event) => {
        if (
          !busy &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          onOpen(card);
        }
      }}
      onDragStart={(
        event,
      ) =>
        onDragStart(
          event,
          card,
        )
      }
      className={`group rounded-2xl border bg-white p-4 shadow-sm transition ${
        busy
          ? 'cursor-wait opacity-60'
          : 'cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing'
      } ${
        card.isCritical
          ? 'border-red-200'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ring-1 ${priorityClass(
                card.priority,
              )}`}
            >
              {card.priority}
            </span>

            {card.isCritical && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                <AlertTriangle className="h-3 w-3" />
                Critical
              </span>
            )}

            {card.isOverdue && (
              <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700 ring-1 ring-rose-100">
                Overdue
              </span>
            )}
          </div>

          <div className="mt-3 flex w-full items-start gap-2 text-left">
            <span className="line-clamp-2 flex-1 text-sm font-black leading-5 text-slate-900">
              {card.title}
            </span>

            {card.column === 'DONE' && canReopen ? (
              <button
                type="button"
                draggable={false}
                title="Reopen task"
                aria-label="Reopen task"
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  onReopen(card);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
            )}
          </div>

          <div className="mt-3 space-y-1.5 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0 text-slate-400" />

              <span className="truncate">
                {card.client.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Columns3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />

              <span className="truncate">
                {card.project.name}
              </span>
            </div>

            {card.category?.name && (
              <div className="flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5 shrink-0 text-slate-400" />

                <span className="truncate">
                  {card.category.name}
                </span>
              </div>
            )}
          </div>

          {card.subtaskProgress.total >
            0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>
                  Subtasks
                </span>

                <span>
                  {
                    card.subtaskProgress
                      .completed
                  }
                  /
                  {
                    card.subtaskProgress
                      .total
                  }
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-800 transition-all"
                  style={{
                    width:
                      `${card.subtaskProgress.percent}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {card.attachmentCount}
              </span>

              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {card.commentCount}
              </span>

              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {hoursLabel(
                  card.loggedHours,
                )}
              </span>
            </div>

            {primary ? (
              <div
                className="flex items-center gap-2"
                title={
                  primary.fullName
                }
              >
                {primary.profileImageUrl ? (
                  <img
                    src={
                      primary.profileImageUrl
                    }
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-white"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white ring-2 ring-white">
                    {initials(
                      primary.fullName,
                    )}
                  </div>
                )}

                {card.assignees.length >
                  1 && (
                  <span className="text-[10px] font-black text-slate-400">
                    +
                    {card.assignees.length -
                      1}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-bold text-slate-400">
                Unassigned
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {card.dueAt
                ? new Date(
                    card.dueAt,
                  ).toLocaleDateString()
                : 'No due date'}
            </span>

            <span>
              Est.{' '}
              {hoursLabel(
                card.estimatedHours,
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const router =
    useRouter();

  const {
    authFetch,
    user,
  } =
    useAuth();

  const isSuperAdmin = Boolean(
    user?.roles?.includes('SUPER_ADMIN'),
  );

  const [
    board,
    setBoard,
  ] =
    useState<BoardResponse | null>(
      null,
    );

  const [
    options,
    setOptions,
  ] =
    useState<Options>({
      clients: [],
      projects: [],
      employees: [],
      priorities: [
        'LOW',
        'MEDIUM',
        'HIGH',
        'URGENT',
      ],
    });

  const [
    filters,
    setFilters,
  ] =
    useState<Filters>(
      emptyFilters,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    movingId,
    setMovingId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    dragging,
    setDragging,
  ] =
    useState<Card | null>(
      null,
    );

  const [
    dragOverColumn,
    setDragOverColumn,
  ] =
    useState<ColumnCode | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  const request =
    useCallback(
      async <T,>(
        path: string,
        init?: RequestInit,
      ): Promise<T> => {
        const response =
          await authFetch(
            path,
            init,
          );

        let data:
          | unknown
          | null = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            messageFrom(
              data,
              'Request failed.',
            ),
          );
        }

        return data as T;
      },
      [authFetch],
    );

  const loadOptions =
    useCallback(
      async () => {
        const data =
          await request<Options>(
            '/kanban/options',
          );

        setOptions(
          data,
        );
      },
      [request],
    );

  const loadBoard =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setLoading(
            true,
          );
        }

        setError('');

        try {
          const params =
            new URLSearchParams();

          Object.entries(
            filters,
          ).forEach(
            ([
              key,
              value,
            ]) => {
              if (
                value.trim()
              ) {
                params.set(
                  key,
                  value.trim(),
                );
              }
            },
          );

          const data =
            await request<BoardResponse>(
              `/kanban/board?${params.toString()}`,
            );

          setBoard(
            data,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load Kanban board.',
          );
        } finally {
          if (!silent) {
            setLoading(
              false,
            );
          }
        }
      },
      [
        filters,
        request,
      ],
    );

  useEffect(() => {
    void Promise.all([
      loadOptions(),
      loadBoard(),
    ]).catch(
      (err) => {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load Kanban.',
        );
      },
    );
  }, [
    loadOptions,
    loadBoard,
  ]);

  const filteredProjects =
    useMemo(
      () =>
        options.projects.filter(
          (project) =>
            !filters.clientId ||
            project.clientId ===
              filters.clientId,
        ),
      [
        options.projects,
        filters.clientId,
      ],
    );

  const dragStart =
    (
      event: DragEvent<HTMLDivElement>,
      card: Card,
    ) => {
      setDragging(
        card,
      );

      event.dataTransfer.effectAllowed =
        'move';

      event.dataTransfer.setData(
        'text/plain',
        card.id,
      );
    };

  const optimisticMove =
    (
      taskId: string,
      from: ColumnCode,
      to: ColumnCode,
    ) => {
      setBoard(
        (current) => {
          if (!current) {
            return current;
          }

          const task =
            current.columns[
              from
            ].find(
              (item) =>
                item.id ===
                taskId,
            );

          if (!task) {
            return current;
          }

          return {
            ...current,
            columns: {
              ...current.columns,
              [from]:
                current.columns[
                  from
                ].filter(
                  (item) =>
                    item.id !==
                    taskId,
                ),
              [to]: [
                {
                  ...task,
                  column:
                    to,
                },
                ...current.columns[
                  to
                ],
              ],
            },
          };
        },
      );
    };

  const moveTask =
    async (
      card: Card,
      target:
        ColumnCode,
    ) => {
      if (
        card.column ===
        target
      ) {
        return;
      }

      let note:
        | string
        | undefined;

      if (
        target ===
        'CHANGES_REQUESTED'
      ) {
        if (!board?.permissions.canReview) {
          await appDialog.alert({
            title: 'Action not allowed',
            message: 'You are not allowed for this.',
          });
          return;
        }

        const response =
          await appDialog.prompt({
            title: 'Request changes',
            message: 'Add the reason for changes.',
            defaultValue:
              'Please make the requested corrections.',
            placeholder: 'Reason for changes',
            multiline: true,
            required: true,
          });

        if (
          response ===
          null
        ) {
          return;
        }

        note =
          response.trim() ||
          'Changes requested';
      }

      if (
        target ===
        'DONE'
      ) {
        const response =
          await appDialog.prompt({
            title: 'Approve task',
            message: 'Add an approval note if needed.',
            defaultValue: 'Approved',
            placeholder: 'Approval note (optional)',
            multiline: true,
          });

        if (
          response ===
          null
        ) {
          return;
        }

        note =
          response.trim() ||
          undefined;
      }

      setMovingId(
        card.id,
      );
      setError('');
      setSuccess('');

      const originalColumn =
        card.column;

      optimisticMove(
        card.id,
        originalColumn,
        target,
      );

      try {
        const result =
          await request<{
            message: string;
            completed: boolean;
          }>(
            `/kanban/${card.id}/move`,
            {
              method:
                'PATCH',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  targetCode:
                    target,
                  note,
                }),
            },
          );

        setSuccess(
          result.message,
        );

        await loadBoard(
          true,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to move task.',
        );

        await loadBoard(
          true,
        );
      } finally {
        setMovingId(
          null,
        );
      }
    };

  const reopenTask = async (card: Card) => {
    const confirmed = await appDialog.confirm({
      title: 'Reopen completed task',
      message: `Reopen "${card.title}" and move it back to In Progress?`,
      confirmLabel: 'Reopen Task',
    });

    if (!confirmed) return;

    setMovingId(card.id);
    setError('');
    setSuccess('');

    try {
      const result = await request<{ message: string }>(
        `/kanban/${card.id}/reopen`,
        { method: 'PATCH' },
      );
      setSuccess(result.message);
      await loadBoard(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reopen task.',
      );
    } finally {
      setMovingId(null);
    }
  };

  const drop =
    async (
      event: DragEvent<HTMLElement>,
      target:
        ColumnCode,
    ) => {
      event.preventDefault();

      setDragOverColumn(
        null,
      );

      const card =
        dragging;

      setDragging(
        null,
      );

      if (!card) {
        return;
      }

      await moveTask(
        card,
        target,
      );
    };

  const clearFilters =
    () => {
      setFilters(
        emptyFilters,
      );
    };

  return (
    <div className="mx-auto w-full max-w-[1900px] space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Columns3 className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Kanban Board
            </h1>

          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadBoard()
          }
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[230px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={
                filters.search
              }
              onChange={(
                event,
              ) =>
                setFilters(
                  (
                    current,
                  ) => ({
                    ...current,
                    search:
                      event.target.value,
                  }),
                )
              }
              placeholder="Search task, client or project"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={
              filters.clientId
            }
            onChange={(
              event,
            ) =>
              setFilters(
                (
                  current,
                ) => ({
                  ...current,
                  clientId:
                    event.target.value,
                  projectId:
                    '',
                }),
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">
              All Clients
            </option>

            {options.clients.map(
              (client) => (
                <option
                  key={
                    client.id
                  }
                  value={
                    client.id
                  }
                >
                  {client.name}
                </option>
              ),
            )}
          </select>

          <select
            value={
              filters.projectId
            }
            onChange={(
              event,
            ) =>
              setFilters(
                (
                  current,
                ) => ({
                  ...current,
                  projectId:
                    event.target.value,
                }),
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">
              All Projects
            </option>

            {filteredProjects.map(
              (project) => (
                <option
                  key={
                    project.id
                  }
                  value={
                    project.id
                  }
                >
                  {project.name}
                </option>
              ),
            )}
          </select>

          <select
            value={
              filters.assigneeId
            }
            onChange={(
              event,
            ) =>
              setFilters(
                (
                  current,
                ) => ({
                  ...current,
                  assigneeId:
                    event.target.value,
                }),
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">
              {isSuperAdmin ? 'All Employees' : 'All Assignees'}
            </option>

            {options.employees.map(
              (
                employee,
              ) => (
                <option
                  key={
                    employee.id
                  }
                  value={
                    employee.id
                  }
                >
                  {employee.fullName}
                  {employee.username
                    ? ` (@${employee.username})`
                    : ''}
                </option>
              ),
            )}
          </select>

          <select
            value={
              filters.priority
            }
            onChange={(
              event,
            ) =>
              setFilters(
                (
                  current,
                ) => ({
                  ...current,
                  priority:
                    event.target.value,
                }),
              )
            }
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">
              All Priorities
            </option>

            {options.priorities.map(
              (
                priority,
              ) => (
                <option
                  key={
                    priority
                  }
                  value={
                    priority
                  }
                >
                  {priority}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            onClick={() =>
              void loadBoard()
            }
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
          >
            Apply
          </button>

          {Object.values(
            filters,
          ).some(Boolean) && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-[480px] items-center justify-center">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading Kanban...
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[1500px] grid-cols-5 gap-4">
            {columnConfig.map(
              (
                column,
              ) => {
                const cards =
                  board?.columns[
                    column.code
                  ] ??
                  [];

                const dragActive =
                  dragOverColumn ===
                  column.code;

                return (
                  <section
                    key={
                      column.code
                    }
                    onDragOver={(
                      event,
                    ) => {
                      event.preventDefault();

                      event.dataTransfer.dropEffect =
                        'move';

                      setDragOverColumn(
                        column.code,
                      );
                    }}
                    onDragLeave={() => {
                      if (
                        dragOverColumn ===
                        column.code
                      ) {
                        setDragOverColumn(
                          null,
                        );
                      }
                    }}
                    onDrop={(
                      event,
                    ) =>
                      void drop(
                        event,
                        column.code,
                      )
                    }
                    className={`min-h-[650px] rounded-3xl border p-3 transition ${
                      dragActive
                        ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-slate-100/60'
                    }`}
                  >
                    <div
                      className={`mb-3 rounded-2xl border p-3 ${column.headerClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h2 className="text-sm font-black">
                            {column.label}
                          </h2>

                          <p className="mt-0.5 text-[11px] font-semibold opacity-70">
                            {column.hint}
                          </p>
                        </div>

                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-xs font-black shadow-sm">
                          {cards.length}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {cards.map(
                        (
                          card,
                        ) => (
                          <TaskCard
                            key={
                              card.id
                            }
                            card={
                              card
                            }
                            busy={
                              movingId ===
                              card.id
                            }
                            onDragStart={
                              dragStart
                            }
                            onOpen={(
                              task,
                            ) =>
                              router.push(
                                `/tasks?task=${task.id}&from=kanban`,
                              )
                            }
                            canReopen={Boolean(board?.permissions.canReopen)}
                            onReopen={(task) => void reopenTask(task)}
                          />
                        ),
                      )}

                      {!cards.length && (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-7 text-center">
                          <CheckCircle2 className="mx-auto h-6 w-6 text-slate-300" />

                          <p className="mt-2 text-xs font-bold text-slate-400">
                            Drop task here
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              },
            )}
          </div>
        </div>
      )}

    </div>
  );
}
