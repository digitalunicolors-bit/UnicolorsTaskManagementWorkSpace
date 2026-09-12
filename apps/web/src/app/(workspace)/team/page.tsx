'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { appDialog } from '@/components/ui/app-dialog-provider';

interface Employee {
  id: string;
  employeeId: string;
  username?: string | null;
  fullName: string;
  designation?: string | null;
  employmentStatus: string;
  departmentId?: string | null;

  department?: {
    id: string;
    name: string;
  } | null;

  reportingManager?: {
    id: string;
    employeeId: string;
    fullName: string;
    designation?: string | null;
  } | null;

  teamMemberships?: Array<{
    id: string;
    team: {
      id: string;
      name: string;
    };
  }>;

  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    isActive: boolean;
    lastLoginAt?: string | null;
    roles: Array<{
      role: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface Department {
  id: string;
  name: string;
}

function unwrapArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    Array.isArray(
      (payload as { data?: unknown }).data,
    )
  ) {
    return (
      payload as { data: T[] }
    ).data;
  }

  return [];
}

function statusClasses(
  employee: Employee,
) {
  if (
    employee.employmentStatus === 'ACTIVE' &&
    employee.user.isActive
  ) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }

  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function TeamPage() {
  const {
    authFetch,
    user,
  } = useAuth();

  const isSuperAdmin =
    Boolean(user?.roles?.includes('SUPER_ADMIN'));

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

  const isDepartmentScoped =
    isManager || isTeamMember;

  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [departments, setDepartments] =
    useState<Department[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState('');
  const [search, setSearch] =
    useState('');
  const [departmentFilter, setDepartmentFilter] =
    useState('ALL');
  const [statusFilter, setStatusFilter] =
    useState('ALL');
  const [removingId, setRemovingId] =
    useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const employeesResponse =
        await authFetch('/employees/team-directory');

      if (!employeesResponse.ok) {
        throw new Error(
          'Unable to load team members.',
        );
      }

      const employeesPayload =
        await employeesResponse.json();

      setEmployees(
        unwrapArray<Employee>(employeesPayload),
      );

      if (isDepartmentScoped) {
        setDepartments([]);
      } else {
        const departmentsResponse =
          await authFetch('/departments');

        if (departmentsResponse.ok) {
          const departmentsPayload =
            await departmentsResponse.json();

          setDepartments(
            unwrapArray<Department>(
              departmentsPayload,
            ),
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load team.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    authFetch,
    isDepartmentScoped,
  ]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);


  const removeMember = async (employee: Employee) => {
    const confirmed = await appDialog.confirm({
      title: 'Remove team member',
      message: `Remove ${employee.fullName} from the workspace? Their login will be disabled and historical work will be preserved.`,
      confirmLabel: 'Remove Member',
      tone: 'danger',
    });

    if (!confirmed) return;

    setRemovingId(employee.id);
    setError('');

    try {
      const response = await authFetch(`/employees/${employee.id}`, {
        method: 'DELETE',
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === 'object' &&
          'message' in payload
            ? (payload as { message?: string | string[] }).message
            : null;

        throw new Error(
          Array.isArray(message)
            ? message.join(', ')
            : typeof message === 'string'
              ? message
              : 'Unable to remove team member.',
        );
      }

      await loadTeam();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to remove team member.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (
        isManager &&
        employee.user.id === user?.id
      ) {
        return false;
      }

      const roles = employee.user.roles
        .map((item) => item.role.name)
        .join(' ');

      const teams =
        employee.teamMemberships
          ?.map((item) => item.team.name)
          .join(' ') ?? '';

      const matchesSearch =
        !query ||
        [
          employee.fullName,
          employee.employeeId,
          employee.username ?? '',
          employee.designation ?? '',
          employee.department?.name ?? '',
          employee.reportingManager?.fullName ?? '',
          employee.user.email ?? '',
          employee.user.phone ?? '',
          roles,
          teams,
        ].some((value) =>
          value.toLowerCase().includes(query),
        );

      const matchesDepartment =
        isDepartmentScoped ||
        departmentFilter === 'ALL' ||
        (departmentFilter === 'UNASSIGNED'
          ? !employee.departmentId
          : employee.departmentId ===
            departmentFilter);

      const matchesStatus =
        statusFilter === 'ALL' ||
        employee.employmentStatus ===
          statusFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesStatus
      );
    });
  }, [
    departmentFilter,
    employees,
    isDepartmentScoped,
    isManager,
    search,
    statusFilter,
    user?.id,
  ]);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {isManager
              ? 'Team Members'
              : isTeamMember
                ? 'Team'
                : 'Complete Team'}
          </h1>

        </div>

        <button
          type="button"
          onClick={() => void loadTeam()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${
              loading ? 'animate-spin' : ''
            }`}
          />
          Refresh Team
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div
            className={`grid gap-3 ${
              isDepartmentScoped
                ? 'lg:grid-cols-[1fr_180px]'
                : 'lg:grid-cols-[1fr_220px_180px]'
            }`}
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, member ID, role, department, manager, contact..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            {!isDepartmentScoped && (
              <select
                value={departmentFilter}
                onChange={(event) =>
                  setDepartmentFilter(
                    event.target.value,
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="ALL">
                  All Departments
                </option>
                <option value="UNASSIGNED">
                  Unassigned
                </option>
                {departments.map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="ALL">
                All Statuses
              </option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">
                Inactive
              </option>
              <option value="RESIGNED">
                Resigned
              </option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : loading && !employees.length ? (
          <div className="p-10 text-center text-sm text-slate-500">
            {isDepartmentScoped
              ? 'Loading team members...'
              : 'Loading complete team...'}
          </div>
        ) : filteredEmployees.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Team Member</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Designation / Role</th>
                  <th className="px-5 py-3">Reports To</th>
                  <th className="px-5 py-3">Teams</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee) => {
                  const roles = employee.user.roles.map(
                    (item) => item.role.name,
                  );

                  return (
                    <tr
                      key={employee.id}
                      className="align-top hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">
                          {employee.fullName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {employee.employeeId}
                          {employee.username
                            ? ` · @${employee.username}`
                            : ''}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {employee.department?.name ?? (
                          <span className="text-slate-400">
                            Not assigned
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-800">
                          {employee.designation || '—'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {roles.length ? (
                            roles.map((role) => (
                              <span
                                key={role}
                                className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
                              >
                                {role === 'EMPLOYEE'
                                  ? 'TEAM MEMBER'
                                  : role.replaceAll('_', ' ')}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">
                              No role
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {employee.reportingManager?.fullName ?? (
                          <span className="text-slate-400">
                            —
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {employee.teamMemberships?.length ? (
                            employee.teamMemberships.map(
                              (membership) => (
                                <span
                                  key={membership.id}
                                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                                >
                                  {membership.team.name}
                                </span>
                              ),
                            )
                          ) : (
                            <span className="text-sm text-slate-400">
                              —
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600">
                        <p>
                          {employee.user.email || '—'}
                        </p>
                        <p className="mt-1">
                          {employee.user.phone || '—'}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClasses(
                              employee,
                            )}`}
                          >
                            {employee.employmentStatus.replaceAll(
                              '_',
                              ' ',
                            )}
                          </span>

                          {isSuperAdmin &&
                            !roles.includes('SUPER_ADMIN') && (
                              <button
                                type="button"
                                title="Remove member"
                                aria-label={`Remove ${employee.fullName}`}
                                disabled={removingId === employee.id}
                                onClick={() => void removeMember(employee)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
        ) : (
          <div className="p-10 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {isManager
                ? 'No team members found.'
                : 'No team members match these filters.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

