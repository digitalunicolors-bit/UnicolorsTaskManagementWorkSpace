'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
  RefreshCcw,
  Search,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { unwrapDashboardData } from '@/components/dashboard/dashboard-kit';

type ViewKind =
  | 'departments'
  | 'clients'
  | 'projects'
  | 'tasks'
  | 'dueToday'
  | 'inProgress'
  | 'waitingReview'
  | 'completed'
  | 'overdue'
  | 'critical';

type DashboardData = {
  stats: {
    totalDepartments: number;
    activeDepartments: number;
    totalClients: number;
    activeClients: number;
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    dueToday: number;
    overdue: number;
    inProgress: number;
    waitingReview: number;
    completed: number;
    criticalTasks: number;
  };
};

type Department = {
  id: string;
  name: string;
  isActive: boolean;
  head?: {
    fullName: string;
  } | null;
  _count?: {
    members?: number;
    teams?: number;
  };
};

type Client = {
  id: string;
  name: string;
  companyName?: string | null;
  status?: string;
  isActive?: boolean;
};

type Project = {
  id: string;
  name: string;
  status?: string;
  priority?: string;
  deadline?: string | null;
  client?: {
    name: string;
  } | null;
};

type Task = {
  id: string;
  title: string;
  dueAt?: string | null;
  priority?: string;
  isCritical?: boolean;
  status?: {
    code?: string;
    name?: string;
  } | null;
  client?: {
    name: string;
  } | null;
  project?: {
    name: string;
  } | null;
  assignees?: Array<{
    employee?: {
      fullName?: string;
    } | null;
  }>;
};

type Row = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  danger?: boolean;
};

type PagedPayload<T> = {
  data?: T[];
  meta?: {
    page?: number;
    totalPages?: number;
  };
};

const completedCodes = [
  'DONE',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];

const reviewCodes = [
  'REVIEW',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
  'UNDER_REVIEW',
];

const sections: Array<{
  key: ViewKind;
  label: string;
}> = [
  { key: 'departments', label: 'Departments' },
  { key: 'clients', label: 'Clients' },
  { key: 'projects', label: 'Projects' },
  { key: 'tasks', label: 'All Tasks' },
  { key: 'dueToday', label: 'Due Today' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'waitingReview', label: 'Waiting Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'critical', label: 'Critical' },
];

function isViewKind(value: string | null): value is ViewKind {
  return sections.some(
    (section) => section.key === value,
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'No deadline';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No deadline';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function isSameLocalDay(
  left: Date,
  right: Date,
) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default function SuperAdminDashboardDetailsPage() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView: ViewKind = isViewKind(
    requestedView,
  )
    ? requestedView
    : 'departments';

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);
  const [departments, setDepartments] =
    useState<Department[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] =
    useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(
    async <T,>(path: string): Promise<T[]> => {
      const separator = path.includes('?') ? '&' : '?';
      const firstResponse = await authFetch(
        `${path}${separator}page=1&limit=100`,
      );

      if (!firstResponse.ok) {
        throw new Error('Unable to load list data.');
      }

      const firstPayload =
        (await firstResponse.json()) as
          | T[]
          | PagedPayload<T>;

      if (Array.isArray(firstPayload)) {
        return firstPayload;
      }

      const firstData = firstPayload.data ?? [];
      const totalPages = Math.max(
        1,
        firstPayload.meta?.totalPages ?? 1,
      );

      if (totalPages <= 1) {
        return firstData;
      }

      const remaining = await Promise.all(
        Array.from(
          { length: totalPages - 1 },
          (_, index) => index + 2,
        ).map(async (page) => {
          const response = await authFetch(
            `${path}${separator}page=${page}&limit=100`,
          );

          if (!response.ok) return [] as T[];

          const payload =
            (await response.json()) as
              | T[]
              | PagedPayload<T>;

          return Array.isArray(payload)
            ? payload
            : payload.data ?? [];
        }),
      );

      return [
        ...firstData,
        ...remaining.flat(),
      ];
    },
    [authFetch],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        dashboardResponse,
        departmentsResponse,
        clientsData,
        projectsData,
        tasksData,
      ] = await Promise.all([
        authFetch('/dashboard/super-admin'),
        authFetch('/departments'),
        fetchAll<Client>('/clients'),
        fetchAll<Project>('/projects'),
        fetchAll<Task>('/tasks'),
      ]);

      if (!dashboardResponse.ok) {
        throw new Error(
          'Unable to load dashboard counts.',
        );
      }

      if (!departmentsResponse.ok) {
        throw new Error(
          'Unable to load departments.',
        );
      }

      const dashboardPayload =
        await dashboardResponse.json();
      const departmentsPayload =
        await departmentsResponse.json();

      setDashboard(
        unwrapDashboardData<DashboardData>(
          dashboardPayload,
        ),
      );
      setDepartments(
        Array.isArray(departmentsPayload)
          ? departmentsPayload
          : departmentsPayload.data ?? [],
      );
      setClients(clientsData);
      setProjects(projectsData);
      setTasks(tasksData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load dashboard details.',
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, fetchAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    if (!dashboard) return null;

    return {
      departments: dashboard.stats.totalDepartments,
      clients: dashboard.stats.totalClients,
      projects: dashboard.stats.totalProjects,
      tasks: dashboard.stats.totalTasks,
      dueToday: dashboard.stats.dueToday,
      inProgress: dashboard.stats.inProgress,
      waitingReview: dashboard.stats.waitingReview,
      completed: dashboard.stats.completed,
      overdue: dashboard.stats.overdue,
      critical: dashboard.stats.criticalTasks,
    } satisfies Record<ViewKind, number>;
  }, [dashboard]);

  const rows = useMemo<Row[]>(() => {
    const now = new Date();

    if (activeView === 'departments') {
      return departments.map((department) => ({
        id: department.id,
        title: department.name,
        subtitle: department.head?.fullName
          ? `HOD: ${department.head.fullName}`
          : 'HOD not assigned',
        meta: `${department._count?.members ?? 0} members`,
        href: '/departments',
      }));
    }

    if (activeView === 'clients') {
      return clients.map((client) => ({
        id: client.id,
        title: client.name,
        subtitle: client.companyName || undefined,
        meta: client.status ??
          (client.isActive === false
            ? 'Inactive'
            : 'Active'),
        href: '/clients',
      }));
    }

    if (activeView === 'projects') {
      return projects.map((project) => ({
        id: project.id,
        title: project.name,
        subtitle: project.client?.name || undefined,
        meta: `${project.status ?? 'Unknown'} · ${formatDate(project.deadline)}`,
        href: '/projects',
      }));
    }

    const filteredTasks = tasks.filter((task) => {
      const code =
        task.status?.code?.toUpperCase() ?? '';
      const isCompleted =
        completedCodes.includes(code);
      const dueDate = task.dueAt
        ? new Date(task.dueAt)
        : null;

      switch (activeView) {
        case 'dueToday':
          return Boolean(
            dueDate &&
              !Number.isNaN(dueDate.getTime()) &&
              isSameLocalDay(dueDate, now) &&
              !isCompleted,
          );
        case 'inProgress':
          return [
            'IN_PROGRESS',
            'ACTIVE',
          ].includes(code);
        case 'waitingReview':
          return reviewCodes.includes(code);
        case 'completed':
          return ['DONE', 'COMPLETED'].includes(
            code,
          );
        case 'overdue':
          return Boolean(
            dueDate &&
              !Number.isNaN(dueDate.getTime()) &&
              dueDate < now &&
              !isCompleted,
          );
        case 'critical':
          return Boolean(
            task.isCritical && !isCompleted,
          );
        default:
          return true;
      }
    });

    return filteredTasks.map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: [
        task.client?.name,
        task.project?.name,
        task.assignees?.[0]?.employee?.fullName,
      ]
        .filter(Boolean)
        .join(' · '),
      meta: `${task.status?.name ?? 'Unknown'} · ${formatDate(task.dueAt)}`,
      href: '/tasks',
      danger:
        activeView === 'overdue' ||
        Boolean(task.isCritical),
    }));
  }, [
    activeView,
    clients,
    departments,
    projects,
    tasks,
  ]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [
        row.title,
        row.subtitle ?? '',
        row.meta ?? '',
      ].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [rows, search]);

  const activeLabel =
    sections.find(
      (section) => section.key === activeView,
    )?.label ?? 'Dashboard Details';

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Link
            href="/super-admin/dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {activeLabel}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              loading ? 'animate-spin' : ''
            }`}
          />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {sections.map((section) => {
          const active = section.key === activeView;
          const danger =
            section.key === 'overdue' &&
            (counts?.overdue ?? 0) > 0;

          return (
            <Link
              key={section.key}
              href={`/super-admin/dashboard/details?view=${section.key}`}
              className={`rounded-2xl border p-4 transition ${
                danger
                  ? 'border-red-200 bg-red-50'
                  : active
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 bg-white hover:border-indigo-200'
              }`}
            >
              <p
                className={`text-xs font-bold ${
                  danger
                    ? 'text-red-700'
                    : active
                      ? 'text-indigo-700'
                      : 'text-slate-500'
                }`}
              >
                {section.label}
              </p>
              <p
                className={`mt-1 text-2xl font-black ${
                  danger
                    ? 'text-red-950'
                    : 'text-slate-950'
                }`}
              >
                {counts?.[section.key] ?? '—'}
              </p>
            </Link>
          );
        })}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <SectionIcon view={activeView} />
            <div>
              <h2 className="font-black text-slate-950">
                {activeLabel}
              </h2>
              <p className="text-xs text-slate-500">
                {filteredRows.length} record
                {filteredRows.length === 1 ? '' : 's'} shown
              </p>
            </div>
          </div>

          <label className="relative block w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={`Search ${activeLabel.toLowerCase()}...`}
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading complete data...
          </div>
        ) : filteredRows.length ? (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <Link
                key={row.id}
                href={row.href ?? '#'}
                className={`block p-5 transition hover:bg-slate-50 ${
                  row.danger ? 'bg-red-50/40' : ''
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p
                      className={`truncate font-black ${
                        row.danger
                          ? 'text-red-950'
                          : 'text-slate-950'
                      }`}
                    >
                      {row.title}
                    </p>
                    {row.subtitle ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {row.subtitle}
                      </p>
                    ) : null}
                  </div>
                  {row.meta ? (
                    <p
                      className={`shrink-0 text-xs font-bold ${
                        row.danger
                          ? 'text-red-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {row.meta}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-sm text-slate-500">
            No records found.
          </div>
        )}
      </section>
    </div>
  );
}

function SectionIcon({ view }: { view: ViewKind }) {
  const className = 'h-5 w-5';

  if (view === 'departments' || view === 'clients') {
    return (
      <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
        <Building2 className={className} />
      </div>
    );
  }

  if (view === 'projects') {
    return (
      <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
        <FolderKanban className={className} />
      </div>
    );
  }

  if (view === 'completed') {
    return (
      <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
        <CheckCircle2 className={className} />
      </div>
    );
  }

  if (view === 'overdue' || view === 'critical') {
    return (
      <div className="rounded-xl bg-red-50 p-2.5 text-red-700">
        <AlertTriangle className={className} />
      </div>
    );
  }

  if (
    view === 'dueToday' ||
    view === 'waitingReview'
  ) {
    return (
      <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
        <Clock3 className={className} />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
      <ListTodo className={className} />
    </div>
  );
}
