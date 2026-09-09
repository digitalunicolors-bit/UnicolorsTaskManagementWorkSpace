'use client';

import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';

import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import {
  DashboardError,
  DashboardHeader,
  DashboardLoading,
  RefreshButton,
  StatCard,
  unwrapDashboardData,
} from '@/components/dashboard/dashboard-kit';

type SuperAdminDashboardData = {
  role: 'SUPER_ADMIN';
  stats: {
    totalDepartments: number;
    activeDepartments: number;
    totalEmployees: number;
    activeEmployees: number;
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

export default function SuperAdminDashboardPage() {
  const { authFetch } = useAuth();
  const [data, setData] =
    useState<SuperAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [overdueAlert, setOverdueAlert] =
    useState(false);
  const previousOverdue = useRef<number | null>(
    null,
  );

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);

      try {
        const response = await authFetch(
          '/dashboard/super-admin',
        );

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'You do not have access to the Super Admin Dashboard.'
              : 'Unable to load Super Admin Dashboard.',
          );
        }

        const json = await response.json();
        const nextData =
          unwrapDashboardData<SuperAdminDashboardData>(
            json,
          );

        setData(nextData);

        const currentOverdue =
          nextData.stats.overdue;

        if (
          currentOverdue > 0 &&
          (previousOverdue.current === null ||
            currentOverdue >
              previousOverdue.current)
        ) {
          setOverdueAlert(true);
        }

        previousOverdue.current =
          currentOverdue;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard.',
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard(true);
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  if (loading && !data) {
    return (
      <DashboardLoading message="Loading Super Admin Dashboard..." />
    );
  }

  if (error && !data) {
    return (
      <div className="p-6">
        <DashboardError
          message={error}
          onRetry={() => void loadDashboard()}
        />
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;

  return (
    <div className="space-y-4 p-3 sm:p-4">
      {overdueAlert && stats.overdue > 0 ? (
        <div className="fixed right-4 top-4 z-[80] w-[min(92vw,380px)] rounded-2xl border border-red-300 bg-red-600 p-4 text-white shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="font-black">
                Overdue Task Alert
              </p>
              <p className="mt-1 text-sm text-red-50">
                {stats.overdue} overdue task
                {stats.overdue === 1 ? '' : 's'} need attention.
              </p>
              <Link
                href="/super-admin/dashboard/details?view=overdue"
                onClick={() =>
                  setOverdueAlert(false)
                }
                className="mt-3 inline-flex rounded-lg bg-white px-3 py-1.5 text-xs font-black text-red-700"
              >
                Open Overdue Page
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setOverdueAlert(false)}
              className="rounded-lg px-2 py-1 text-red-100 hover:bg-red-500"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <DashboardHeader
        eyebrow="System Control Center"
        title="Super Admin Dashboard"
        description=""
        actions={
          <>
            <RefreshButton
              loading={loading}
              onClick={() => void loadDashboard()}
            />
            <Link
              href="/tasks?critical=1"
              aria-label="Critical Task"
              title="Critical Task"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm transition hover:bg-red-700"
            >
              <AlertTriangle className="h-4 w-4" />
            </Link>
            <Link
              href="/tasks"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              Create Task
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatLink href="/super-admin/dashboard/details?view=departments">
          <StatCard
            label="Departments"
            value={stats.totalDepartments}
            hint={`${stats.activeDepartments} active`}
            icon={<Building2 className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=clients">
          <StatCard
            label="Clients"
            value={stats.totalClients}
            hint={`${stats.activeClients} active`}
            icon={<Building2 className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=projects">
          <StatCard
            label="Projects"
            value={stats.totalProjects}
            hint={`${stats.activeProjects} active`}
            icon={<FolderKanban className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=tasks">
          <StatCard
            label="Total Tasks"
            value={stats.totalTasks}
            icon={<ListTodo className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=dueToday">
          <StatCard
            label="Due Today"
            value={stats.dueToday}
            icon={<Clock3 className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=inProgress">
          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={<Activity className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=waitingReview">
          <StatCard
            label="Waiting Review"
            value={stats.waitingReview}
            icon={<Clock3 className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink href="/super-admin/dashboard/details?view=completed">
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink
          href="/super-admin/dashboard/details?view=overdue"
          danger={stats.overdue > 0}
        >
          <StatCard
            label="Overdue"
            value={stats.overdue}
            danger={stats.overdue > 0}
            hint={
              stats.overdue > 0
                ? 'Needs immediate attention'
                : 'No overdue tasks'
            }
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </StatLink>

        <StatLink
          href="/super-admin/dashboard/details?view=critical"
          danger={stats.criticalTasks > 0}
        >
          <StatCard
            label="Critical"
            value={stats.criticalTasks}
            danger={stats.criticalTasks > 0}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </StatLink>
      </div>


    </div>
  );
}

function StatLink({
  href,
  children,
  danger = false,
}: {
  href: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block w-full text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        danger
          ? 'rounded-2xl ring-2 ring-red-100'
          : ''
      }`}
    >
      {children}
    </Link>
  );
}

