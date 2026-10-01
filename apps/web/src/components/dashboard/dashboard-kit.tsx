"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

export type DashboardTask = {
  id: string;
  title: string;
  priority: string;
  dueAt?: string | null;
  startDate?: string | null;
  estimatedHours?: number | string | null;
  isCritical?: boolean;
  isDraft?: boolean;
  updatedAt?: string;

  status?: {
    id: string;
    code: string;
    name: string;
    color?: string | null;
  } | null;

  client?: {
    id: string;
    name: string;
  } | null;

  project?: {
    id: string;
    name: string;
  } | null;

  assignees?: Array<{
    id: string;
    isPrimary: boolean;

    employee: {
      id: string;
      fullName: string;
      profileImageUrl?: string | null;
    };
  }>;
};

export type DashboardProject = {
  id: string;
  name: string;
  status: string;
  priority: string;
  deadline?: string | null;

  client?: {
    id: string;
    name: string;
  } | null;

  projectManager?: {
    id: string;
    fullName: string;
  } | null;

  _count?: {
    tasks?: number;
    members?: number;
  };
};

export function unwrapDashboardData<T>(
  payload: unknown,
): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload
  ) {
    const wrapped = payload as {
      data?: unknown;
    };

    if (wrapped.data !== undefined) {
      return wrapped.data as T;
    }
  }

  return payload as T;
}

export function formatDashboardDate(
  value?: string | null,
) {
  if (!value) {
    return "No deadline";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function priorityClasses(
  priority?: string,
) {
  switch (priority?.toUpperCase()) {
    case "URGENT":
      return "bg-red-50 text-red-700 ring-red-200";

    case "HIGH":
      return "bg-orange-50 text-orange-700 ring-orange-200";

    case "LOW":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

export function PriorityBadge({
  priority,
}: {
  priority?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset ${priorityClasses(
        priority,
      )}`}
    >
      {priority || "MEDIUM"}
    </span>
  );
}

export function StatusBadge({
  name,
}: {
  name?: string | null;
}) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
      {name || "Unknown"}
    </span>
  );
}

export function DashboardHeader({
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  if (!actions) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions}
    </div>
  );
}

export function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw
        className={`h-4 w-4 ${
          loading ? "animate-spin" : ""
        }`}
      />

      Refresh
    </button>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  danger = false,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        danger
          ? "border-red-200 bg-red-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-sm font-semibold ${
              danger
                ? "text-red-700"
                : "text-slate-500"
            }`}
          >
            {label}
          </p>

          <p
            className={`mt-1.5 text-2xl font-black ${
              danger
                ? "text-red-950"
                : "text-slate-950"
            }`}
          >
            {value}
          </p>

          {hint ? (
            <p className="mt-1 text-xs text-slate-500">
              {hint}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            danger
              ? "bg-red-100 text-red-700"
              : "bg-violet-50 text-violet-700"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-black text-slate-900">
            {title}
          </h2>

          {description ? (
            <p className="mt-1 text-xs text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {action}
      </div>

      <div className="p-4">
        {children}
      </div>
    </section>
  );
}

export function TaskList({
  tasks,
}: {
  tasks: DashboardTask[];
}) {
  if (!tasks.length) {
    return (
      <EmptyState message="No tasks found." />
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {task.isCritical ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : null}

              <p className="truncate font-bold text-slate-900">
                {task.title}
              </p>

              <PriorityBadge
                priority={task.priority}
              />

              <StatusBadge
                name={task.status?.name}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {task.client?.name ? (
                <span>
                  Client: {task.client.name}
                </span>
              ) : null}

              {task.project?.name ? (
                <span>
                  Project: {task.project.name}
                </span>
              ) : null}

              <span>
                Due:{" "}
                {formatDashboardDate(
                  task.dueAt,
                )}
              </span>
            </div>
          </div>

          {task.assignees?.length ? (
            <div className="text-xs font-semibold text-slate-600">
              {task.assignees
                .slice(0, 2)
                .map(
                  (item) =>
                    item.employee.fullName,
                )
                .join(", ")}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ProjectList({
  projects,
}: {
  projects: DashboardProject[];
}) {
  if (!projects.length) {
    return (
      <EmptyState message="No projects found." />
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {projects.map((project) => (
        <div
          key={project.id}
          className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-slate-900">
                {project.name}
              </p>

              <PriorityBadge
                priority={project.priority}
              />

              <StatusBadge
                name={project.status}
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              {project.client?.name ||
                "No client"}{" "}
              · Deadline:{" "}
              {formatDashboardDate(
                project.deadline,
              )}
            </p>
          </div>

          {project._count ? (
            <div className="flex gap-4 text-xs font-semibold text-slate-500">
              <span>
                {project._count.tasks ?? 0}{" "}
                tasks
              </span>

              <span>
                {project._count.members ?? 0}{" "}
                members
              </span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-violet-200 hover:bg-violet-50/60"
    >
      <div>
        <p className="font-bold text-slate-900">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600" />
    </Link>
  );
}

export function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function DashboardLoading({
  message = "Loading workspace...",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center">
      <div className="text-center">
        <RefreshCw className="mx-auto h-7 w-7 animate-spin text-violet-600" />

        <p className="mt-3 text-sm font-semibold text-slate-600">
          {message}
        </p>
      </div>
    </div>
  );
}

export function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />

        <div>
          <p className="font-bold text-red-900">
            Dashboard could not load
          </p>

          <p className="mt-1 text-sm text-red-700">
            {message}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}