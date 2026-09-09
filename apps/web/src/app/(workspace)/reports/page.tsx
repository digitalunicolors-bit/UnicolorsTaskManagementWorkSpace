'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

type Tab =
  | 'overview'
  | 'employees'
  | 'projects'
  | 'due'
  | 'clients';

type Filters = {
  start: string;
  end: string;
  employeeId: string;
  departmentId: string;
  clientId: string;
  projectId: string;
  statusId: string;
  priority: string;
};

type Options = {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    clientId: string;
    departmentId?: string | null;
  }>;
  employees: Array<{
    id: string;
    fullName: string;
    username?: string | null;
    departmentId?: string | null;
  }>;
  departments: Array<{ id: string; name: string }>;
  statuses: Array<{ id: string; code: string; name: string }>;
  priorities: string[];
  canExport: boolean;
};

type TaskRow = {
  taskId: string;
  title: string;
  client: string;
  project: string;
  department: string;
  assignees: string;
  status: string;
  statusCode: string;
  priority: string;
  dueAt?: string | null;
  completedAt?: string | null;
  isOverdue: boolean;
  estimatedHours: number;
  loggedHours: number;
};

type ReportData = {
  range: {
    start: string;
    end: string;
    semantics: string;
  };
  generatedAt: string;
  overview: {
    totalTasks: number;
    dueToday: number;
    overdue: number;
    completed: number;
    inProgress: number;
    waitingReview: number;
    completionRate: number;
    loggedHours: number;
  };
  employeePerformance: Array<{
    employeeId: string;
    employeeCode: string;
    fullName: string;
    username?: string | null;
    designation?: string | null;
    department: string;
    tasksAssigned: number;
    tasksCompleted: number;
    onTimeTasks: number;
    overdueTasks: number;
    activeWorkload: number;
    averageCompletionHours: number;
    loggedHours: number;
    completionRate: number;
  }>;
  projectReport: Array<{
    projectId: string;
    projectName: string;
    client: string;
    manager: string;
    status: string;
    priority: string;
    deadline?: string | null;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    progress: number;
    milestoneProgress: number;
    milestonesCompleted: number;
    milestonesTotal: number;
    estimatedHours: number;
    loggedHours: number;
    teamMembers: number;
  }>;
  dueDateReport: {
    upcomingDeadlines: TaskRow[];
    overdueTasks: TaskRow[];
    dueToday: TaskRow[];
    dueThisWeek: TaskRow[];
    rescheduledTasks: TaskRow[];
  };
  clientReport: Array<{
    clientId: string;
    clientName: string;
    companyName: string;
    status: string;
    activeProjects: number;
    completedProjects: number;
    pendingTasks: number;
    overdueTasks: number;
    assignedTeamMembers: number;
    totalProjects: number;
    totalTasks: number;
  }>;
  taskRows: TaskRow[];
  permissions: {
    canExport: boolean;
  };
};

function getDefaultRange() {
  const now =
    new Date();

  const start =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

  const end =
    new Date(
      now.getFullYear(),
      now.getMonth() +
        1,
      1,
    );

  const toInput =
    (date: Date) => {
      const local =
        new Date(
          date.getTime() -
            date.getTimezoneOffset() *
              60000,
        );

      return local
        .toISOString()
        .slice(0, 10);
    };

  return {
    start:
      toInput(start),
    end:
      toInput(end),
  };
}

function displayDate(
  value?: string | null,
) {
  return value
    ? new Date(
        value,
      ).toLocaleDateString()
    : '—';
}

function escapeCsv(
  value: unknown,
) {
  const text =
    value == null
      ? ''
      : String(value);

  return `"${text.replace(
    /"/g,
    '""',
  )}"`;
}

function escapeXml(
  value: unknown,
) {
  return String(
    value ?? '',
  )
    .replace(
      /&/g,
      '&amp;',
    )
    .replace(
      /</g,
      '&lt;',
    )
    .replace(
      />/g,
      '&gt;',
    )
    .replace(
      /"/g,
      '&quot;',
    );
}

function downloadBlob(
  content: BlobPart,
  type: string,
  filename: string,
) {
  const blob =
    new Blob(
      [content],
      { type },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      'a',
    );

  anchor.href =
    url;
  anchor.download =
    filename;
  document.body.appendChild(
    anchor,
  );
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(
    url,
  );
}

function buildSheets(
  data: ReportData,
) {
  return [
    {
      name:
        'Overview',
      rows: [
        ['Metric', 'Value'],
        ['Total Tasks', data.overview.totalTasks],
        ['Due Today', data.overview.dueToday],
        ['Overdue', data.overview.overdue],
        ['Completed', data.overview.completed],
        ['In Progress', data.overview.inProgress],
        ['Waiting Review', data.overview.waitingReview],
        ['Completion Rate', `${data.overview.completionRate}%`],
        ['Logged Hours', data.overview.loggedHours],
      ],
    },
    {
      name:
        'Employees',
      rows: [
        [
          'Employee',
          'Department',
          'Assigned',
          'Completed',
          'On Time',
          'Overdue',
          'Workload',
          'Avg Completion Hours',
          'Logged Hours',
          'Completion %',
        ],
        ...data.employeePerformance.map(
          (row) => [
            row.fullName,
            row.department,
            row.tasksAssigned,
            row.tasksCompleted,
            row.onTimeTasks,
            row.overdueTasks,
            row.activeWorkload,
            row.averageCompletionHours,
            row.loggedHours,
            row.completionRate,
          ],
        ),
      ],
    },
    {
      name:
        'Projects',
      rows: [
        [
          'Project',
          'Client',
          'Manager',
          'Status',
          'Priority',
          'Progress %',
          'Tasks',
          'Completed',
          'Overdue',
          'Milestone %',
          'Estimated Hours',
          'Logged Hours',
        ],
        ...data.projectReport.map(
          (row) => [
            row.projectName,
            row.client,
            row.manager,
            row.status,
            row.priority,
            row.progress,
            row.totalTasks,
            row.completedTasks,
            row.overdueTasks,
            row.milestoneProgress,
            row.estimatedHours,
            row.loggedHours,
          ],
        ),
      ],
    },
    {
      name:
        'Tasks',
      rows: [
        [
          'Task',
          'Client',
          'Project',
          'Department',
          'Assignees',
          'Status',
          'Priority',
          'Due',
          'Completed',
          'Overdue',
          'Estimated Hours',
          'Logged Hours',
        ],
        ...data.taskRows.map(
          (row) => [
            row.title,
            row.client,
            row.project,
            row.department,
            row.assignees,
            row.status,
            row.priority,
            displayDate(
              row.dueAt,
            ),
            displayDate(
              row.completedAt,
            ),
            row.isOverdue
              ? 'Yes'
              : 'No',
            row.estimatedHours,
            row.loggedHours,
          ],
        ),
      ],
    },
    {
      name:
        'Clients',
      rows: [
        [
          'Client',
          'Company',
          'Status',
          'Active Projects',
          'Completed Projects',
          'Pending Tasks',
          'Overdue Tasks',
          'Team Members',
          'Total Projects',
          'Total Tasks',
        ],
        ...data.clientReport.map(
          (row) => [
            row.clientName,
            row.companyName,
            row.status,
            row.activeProjects,
            row.completedProjects,
            row.pendingTasks,
            row.overdueTasks,
            row.assignedTeamMembers,
            row.totalProjects,
            row.totalTasks,
          ],
        ),
      ],
    },
  ];
}

export default function ReportsPage() {
  const {
    authFetch,
    hasPermission,
  } =
    useAuth();

  const defaultRange =
    useMemo(
      () =>
        getDefaultRange(),
      [],
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<Tab>(
      'overview',
    );

  const [
    filters,
    setFilters,
  ] =
    useState<Filters>({
      start:
        defaultRange.start,
      end:
        defaultRange.end,
      employeeId:
        '',
      departmentId:
        '',
      clientId:
        '',
      projectId:
        '',
      statusId:
        '',
      priority:
        '',
    });

  const [
    options,
    setOptions,
  ] =
    useState<Options>({
      clients: [],
      projects: [],
      employees: [],
      departments: [],
      statuses: [],
      priorities: [
        'LOW',
        'MEDIUM',
        'HIGH',
        'URGENT',
      ],
      canExport:
        false,
    });

  const [
    data,
    setData,
  ] =
    useState<ReportData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  const request =
    useCallback(
      async <T,>(
        path: string,
      ): Promise<T> => {
        const response =
          await authFetch(
            path,
          );

        let result:
          | any
          | null = null;

        try {
          result =
            await response.json();
        } catch {
          result =
            null;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            Array.isArray(
              result?.message,
            )
              ? result.message.join(
                  ', ',
                )
              : result?.message ??
                'Request failed.',
          );
        }

        return result as T;
      },
      [authFetch],
    );

  const params =
    useCallback(() => {
      const value =
        new URLSearchParams();

      value.set(
        'start',
        new Date(
          `${filters.start}T00:00:00`,
        ).toISOString(),
      );

      value.set(
        'end',
        new Date(
          `${filters.end}T00:00:00`,
        ).toISOString(),
      );

      (
        [
          'employeeId',
          'departmentId',
          'clientId',
          'projectId',
          'statusId',
          'priority',
        ] as const
      ).forEach(
        (key) => {
          if (
            filters[key]
          ) {
            value.set(
              key,
              filters[key],
            );
          }
        },
      );

      return value;
    }, [filters]);

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );
        setError('');

        try {
          const query =
            params();

          const [
            optionData,
            reportData,
          ] =
            await Promise.all([
              request<Options>(
                '/reports/options',
              ),
              request<ReportData>(
                `/reports/data?${query.toString()}`,
              ),
            ]);

          setOptions(
            optionData,
          );

          setData(
            reportData,
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load reports.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        params,
        request,
      ],
    );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProjects =
    options.projects.filter(
      (project) =>
        (
          !filters.clientId ||
          project.clientId ===
            filters.clientId
        ) &&
        (
          !filters.departmentId ||
          project.departmentId ===
            filters.departmentId
        ),
    );

  const canExport =
    Boolean(
      data?.permissions.canExport ??
      options.canExport,
    ) &&
    (
      hasPermission(
        'reports.export',
      ) ||
      options.canExport
    );

  const exportCsv =
    () => {
      if (
        !data ||
        !canExport
      ) {
        return;
      }

      const sheetName =
        activeTab ===
          'employees'
          ? 'Employees'
          : activeTab ===
              'projects'
            ? 'Projects'
            : activeTab ===
                'clients'
              ? 'Clients'
              : activeTab ===
                  'due'
                ? 'Tasks'
                : 'Overview';

      const sheet =
        buildSheets(
          data,
        ).find(
          (item) =>
            item.name ===
            sheetName,
        );

      const csv =
        (
          sheet?.rows ??
          []
        )
          .map(
            (row) =>
              row
                .map(
                  escapeCsv,
                )
                .join(
                  ',',
                ),
          )
          .join(
            '\r\n',
          );

      downloadBlob(
        `\uFEFF${csv}`,
        'text/csv;charset=utf-8',
        `unicolors-${activeTab}-report.csv`,
      );
    };

  const exportExcel =
    () => {
      if (
        !data ||
        !canExport
      ) {
        return;
      }

      const worksheets =
        buildSheets(
          data,
        )
          .map(
            (sheet) => {
              const rows =
                sheet.rows
                  .map(
                    (row) =>
                      `<Row>${row
                        .map(
                          (cell) =>
                            `<Cell><Data ss:Type="${
                              typeof cell ===
                              'number'
                                ? 'Number'
                                : 'String'
                            }">${escapeXml(
                              cell,
                            )}</Data></Cell>`,
                        )
                        .join(
                          '',
                        )}</Row>`,
                  )
                  .join(
                    '',
                  );

              return `<Worksheet ss:Name="${escapeXml(
                sheet.name,
              )}"><Table>${rows}</Table></Worksheet>`;
            },
          )
          .join(
            '',
          );

      const workbook =
        `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>` +
        `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
        `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
        `${worksheets}</Workbook>`;

      downloadBlob(
        workbook,
        'application/vnd.ms-excel;charset=utf-8',
        'unicolors-reports.xls',
      );
    };

  const exportPdf =
    () => {
      if (
        !data ||
        !canExport
      ) {
        return;
      }

      const popup =
        window.open(
          '',
          '_blank',
          'width=1100,height=800',
        );

      if (!popup) {
        setError(
          'Pop-up blocked. Please allow pop-ups for PDF export.',
        );
        return;
      }

      const sections =
        buildSheets(
          data,
        )
          .map(
            (sheet) =>
              `<section><h2>${escapeXml(
                sheet.name,
              )}</h2><table>${sheet.rows
                .map(
                  (
                    row,
                    index,
                  ) =>
                    `<tr>${row
                      .map(
                        (cell) =>
                          index ===
                          0
                            ? `<th>${escapeXml(
                                cell,
                              )}</th>`
                            : `<td>${escapeXml(
                                cell,
                              )}</td>`,
                      )
                      .join(
                        '',
                      )}</tr>`,
                )
                .join(
                  '',
                )}</table></section>`,
          )
          .join(
            '',
          );

      popup.document.write(
        `<!doctype html><html><head><title>Unicolors Reports</title>` +
          `<style>body{font-family:Arial,sans-serif;color:#0f172a;padding:24px}` +
          `section{page-break-after:always;margin-top:24px}` +
          `table{border-collapse:collapse;width:100%;font-size:10px}` +
          `th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}` +
          `th{background:#f1f5f9}</style></head><body>` +
          `<h1>UNICOLORS — Reports & Analytics</h1>` +
          `<p>Generated ${escapeXml(
            new Date(
              data.generatedAt,
            ).toLocaleString(),
          )}</p>${sections}</body></html>`,
      );

      popup.document.close();

      window.setTimeout(
        () => {
          popup.focus();
          popup.print();
        },
        300,
      );
    };

  if (loading) {
    return (
      <div className="flex min-h-[460px] items-center justify-center gap-2 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading Reports...
      </div>
    );
  }

  const tabs: Array<{
    key: Tab;
    label: string;
  }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'employees', label: 'Employees' },
    { key: 'projects', label: 'Projects' },
    { key: 'due', label: 'Due Dates' },
    { key: 'clients', label: 'Clients' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Reports & Analytics
            </h1>

          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void load()
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

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterInput
            label="From"
            type="date"
            value={filters.start}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  start: value,
                }),
              )
            }
          />

          <FilterInput
            label="To"
            type="date"
            value={filters.end}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  end: value,
                }),
              )
            }
          />

          <SelectFilter
            value={filters.employeeId}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  employeeId: value,
                }),
              )
            }
            placeholder="All Employees"
            options={options.employees.map(
              (employee) => ({
                value: employee.id,
                label: employee.fullName,
              }),
            )}
          />

          <SelectFilter
            value={filters.departmentId}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  departmentId: value,
                  projectId: '',
                }),
              )
            }
            placeholder="All Departments"
            options={options.departments.map(
              (department) => ({
                value: department.id,
                label: department.name,
              }),
            )}
          />

          <SelectFilter
            value={filters.clientId}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  clientId: value,
                  projectId: '',
                }),
              )
            }
            placeholder="All Clients"
            options={options.clients.map(
              (client) => ({
                value: client.id,
                label: client.name,
              }),
            )}
          />

          <SelectFilter
            value={filters.projectId}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  projectId: value,
                }),
              )
            }
            placeholder="All Projects"
            options={filteredProjects.map(
              (project) => ({
                value: project.id,
                label: project.name,
              }),
            )}
          />

          <SelectFilter
            value={filters.statusId}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  statusId: value,
                }),
              )
            }
            placeholder="All Statuses"
            options={options.statuses.map(
              (status) => ({
                value: status.id,
                label: status.name,
              }),
            )}
          />

          <SelectFilter
            value={filters.priority}
            onChange={(value) =>
              setFilters(
                (current) => ({
                  ...current,
                  priority: value,
                }),
              )
            }
            placeholder="All Priorities"
            options={options.priorities.map(
              (priority) => ({
                value: priority,
                label: priority,
              }),
            )}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              void load()
            }
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white"
          >
            Apply Filters
          </button>

          {canExport && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>

              <button
                type="button"
                onClick={exportExcel}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </button>

              <button
                type="button"
                onClick={exportPdf}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
              >
                <FileText className="h-4 w-4" />
                PDF
              </button>
            </div>
          )}
        </div>

        {data?.range.semantics && (
          <p className="mt-3 text-[11px] font-semibold text-slate-400">
            {data.range.semantics}
          </p>
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map(
          (tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() =>
                setActiveTab(
                  tab.key,
                )
              }
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${
                activeTab ===
                tab.key
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ),
        )}
      </div>

      {data &&
        activeTab ===
          'overview' && (
          <Overview
            data={data}
          />
        )}

      {data &&
        activeTab ===
          'employees' && (
          <EmployeesTable
            rows={
              data.employeePerformance
            }
          />
        )}

      {data &&
        activeTab ===
          'projects' && (
          <ProjectsTable
            rows={
              data.projectReport
            }
          />
        )}

      {data &&
        activeTab ===
          'due' && (
          <DueTables
            report={
              data.dueDateReport
            }
          />
        )}

      {data &&
        activeTab ===
          'clients' && (
          <ClientsTable
            rows={
              data.clientReport
            }
          />
        )}
    </div>
  );
}

function Overview({
  data,
}: {
  data: ReportData;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-2">
        <MiniList
          title="Top Employee Workload"
          icon={Users}
          rows={data.employeePerformance
            .slice(0, 8)
            .map(
              (item) => ({
                name: item.fullName,
                value: `${item.activeWorkload} active · ${item.loggedHours.toFixed(2)}h`,
              }),
            )}
        />

        <MiniList
          title="Project Progress"
          icon={BriefcaseBusiness}
          rows={data.projectReport
            .slice(0, 8)
            .map(
              (item) => ({
                name: item.projectName,
                value: `${item.progress}% · ${item.overdueTasks} overdue`,
              }),
            )}
        />
      </div>
    </div>
  );
}

function EmployeesTable({
  rows,
}: {
  rows:
    ReportData['employeePerformance'];
}) {
  return (
    <TableShell title="Employee Performance" icon={Users}>
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400">
            {[
              'Employee',
              'Department',
              'Assigned',
              'Completed',
              'On Time',
              'Overdue',
              'Workload',
              'Avg Completion',
              'Logged',
              'Completion',
            ].map(
              (head) => (
                <th
                  key={head}
                  className="py-3 pr-4"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(
            (row) => (
              <tr
                key={row.employeeId}
                className="border-b border-slate-50"
              >
                <td className="py-3 pr-4 font-black">
                  {row.fullName}
                </td>
                <td className="pr-4">{row.department}</td>
                <td className="pr-4">{row.tasksAssigned}</td>
                <td className="pr-4">{row.tasksCompleted}</td>
                <td className="pr-4">{row.onTimeTasks}</td>
                <td className="pr-4 font-black text-red-600">{row.overdueTasks}</td>
                <td className="pr-4">{row.activeWorkload}</td>
                <td className="pr-4">{row.averageCompletionHours.toFixed(2)}h</td>
                <td className="pr-4">{row.loggedHours.toFixed(2)}h</td>
                <td className="font-black">{row.completionRate}%</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

function ProjectsTable({
  rows,
}: {
  rows:
    ReportData['projectReport'];
}) {
  return (
    <TableShell title="Project Report" icon={BriefcaseBusiness}>
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400">
            {[
              'Project',
              'Client',
              'Manager',
              'Status',
              'Progress',
              'Tasks',
              'Overdue',
              'Milestones',
              'Estimated',
              'Logged',
            ].map(
              (head) => (
                <th
                  key={head}
                  className="py-3 pr-4"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(
            (row) => (
              <tr
                key={row.projectId}
                className="border-b border-slate-50"
              >
                <td className="py-3 pr-4 font-black">{row.projectName}</td>
                <td className="pr-4">{row.client}</td>
                <td className="pr-4">{row.manager}</td>
                <td className="pr-4">{row.status}</td>
                <td className="pr-4 font-black">{row.progress}%</td>
                <td className="pr-4">{row.completedTasks}/{row.totalTasks}</td>
                <td className="pr-4 font-black text-red-600">{row.overdueTasks}</td>
                <td className="pr-4">
                  {row.milestonesCompleted}/{row.milestonesTotal} ({row.milestoneProgress}%)
                </td>
                <td className="pr-4">{row.estimatedHours.toFixed(2)}h</td>
                <td>{row.loggedHours.toFixed(2)}h</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

function DueTables({
  report,
}: {
  report:
    ReportData['dueDateReport'];
}) {
  const groups = [
    ['Due Today', report.dueToday],
    ['Due This Week', report.dueThisWeek],
    ['Upcoming Deadlines', report.upcomingDeadlines],
    ['Overdue Tasks', report.overdueTasks],
    ['Rescheduled Tasks', report.rescheduledTasks],
  ] as const;

  return (
    <div className="space-y-5">
      {groups.map(
        ([title, rows]) => (
          <TableShell
            key={title}
            title={`${title} (${rows.length})`}
            icon={CalendarClock}
          >
            <TaskTable rows={[...rows]} />
          </TableShell>
        ),
      )}
    </div>
  );
}

function ClientsTable({
  rows,
}: {
  rows:
    ReportData['clientReport'];
}) {
  return (
    <TableShell title="Client Report" icon={BriefcaseBusiness}>
      <table className="w-full min-w-[1000px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400">
            {[
              'Client',
              'Status',
              'Active Projects',
              'Completed Projects',
              'Pending Tasks',
              'Overdue',
              'Team',
              'Total Tasks',
            ].map(
              (head) => (
                <th
                  key={head}
                  className="py-3 pr-4"
                >
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(
            (row) => (
              <tr
                key={row.clientId}
                className="border-b border-slate-50"
              >
                <td className="py-3 pr-4">
                  <p className="font-black">{row.clientName}</p>
                  <p className="text-xs text-slate-400">{row.companyName}</p>
                </td>
                <td className="pr-4">{row.status}</td>
                <td className="pr-4">{row.activeProjects}</td>
                <td className="pr-4">{row.completedProjects}</td>
                <td className="pr-4">{row.pendingTasks}</td>
                <td className="pr-4 font-black text-red-600">{row.overdueTasks}</td>
                <td className="pr-4">{row.assignedTeamMembers}</td>
                <td>{row.totalTasks}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </TableShell>
  );
}

function TaskTable({
  rows,
}: {
  rows: TaskRow[];
}) {
  return (
    <table className="w-full min-w-[1000px] text-left text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400">
          {[
            'Task',
            'Client',
            'Project',
            'Assignee',
            'Status',
            'Priority',
            'Due',
            'Logged',
          ].map(
            (head) => (
              <th
                key={head}
                className="py-3 pr-4"
              >
                {head}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map(
          (row) => (
            <tr
              key={row.taskId}
              className="border-b border-slate-50"
            >
              <td className="py-3 pr-4 font-black">{row.title}</td>
              <td className="pr-4">{row.client}</td>
              <td className="pr-4">{row.project}</td>
              <td className="pr-4">{row.assignees}</td>
              <td className="pr-4">{row.status}</td>
              <td className="pr-4">{row.priority}</td>
              <td className={`pr-4 ${row.isOverdue ? 'font-black text-red-600' : ''}`}>
                {displayDate(row.dueAt)}
              </td>
              <td>{row.loggedHours.toFixed(2)}h</td>
            </tr>
          ),
        )}

        {!rows.length && (
          <tr>
            <td
              colSpan={8}
              className="py-8 text-center text-slate-400"
            >
              No data in this section.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function TableShell({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-slate-500" />
        <h2 className="font-black text-slate-950">
          {title}
        </h2>
      </div>

      <div className="mt-4 overflow-x-auto">
        {children}
      </div>
    </section>
  );
}

function MiniList({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Users;
  rows: Array<{
    name: string;
    value: string;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-slate-500" />
        <h2 className="font-black text-slate-950">{title}</h2>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map(
          (row) => (
            <div
              key={`${row.name}-${row.value}`}
              className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3"
            >
              <span className="truncate text-sm font-black text-slate-700">
                {row.name}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-400">
                {row.value}
              </span>
            </div>
          ),
        )}

        {!rows.length && (
          <p className="text-sm text-slate-400">
            No data in selected range.
          </p>
        )}
      </div>
    </section>
  );
}

function FilterInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      />
    </label>
  );
}

function SelectFilter({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{
    value: string;
    label: string;
  }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(
          event.target.value,
        )
      }
      className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm xl:self-end"
    >
      <option value="">
        {placeholder}
      </option>

      {options.map(
        (option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ),
      )}
    </select>
  );
}
