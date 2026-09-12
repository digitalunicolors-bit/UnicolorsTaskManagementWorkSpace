'use client';

import type { FormEvent } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Building2,
  ChevronRight,
  Edit3,
  KeyRound,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  UserRoundPlus,
  Users,
  X,
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
  reportingManagerId?: string | null;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    isActive: boolean;
    mustChangePassword?: boolean;
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
  headId?: string | null;
  isActive: boolean;
  head?: {
    id: string;
    employeeId: string;
    fullName: string;
    designation?: string | null;
  } | null;
  _count?: {
    members?: number;
    teams?: number;
  };
}

type PersonDraft = {
  key: string;
  name: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  username?: string;
  temporaryPassword?: string;
};

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
    return (payload as { data: T[] }).data;
  }

  return [];
}

function getErrorMessage(
  payload: unknown,
  fallback: string,
) {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload
  ) {
    const message = (
      payload as {
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

export default function DepartmentsPage() {
  const { authFetch, hasPermission, hasRole } =
    useAuth();

  const canManage =
    hasRole('SUPER_ADMIN') &&
    hasPermission('departments.manage');

  const [departments, setDepartments] =
    useState<Department[]>([]);
  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState('');
  const [search, setSearch] =
    useState('');
  const [
    selectedDepartment,
    setSelectedDepartment,
  ] = useState<Department | null>(
    null,
  );
  const [modalOpen, setModalOpen] =
    useState(false);
  const [
    detailDepartment,
    setDetailDepartment,
  ] = useState<Department | null>(
    null,
  );

  const [
    loginEmployee,
    setLoginEmployee,
  ] = useState<Employee | null>(
    null,
  );
  const [
    loginSaving,
    setLoginSaving,
  ] = useState(false);
  const [
    loginError,
    setLoginError,
  ] = useState('');

  const loadData =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const [
          departmentsResponse,
          employeesResponse,
        ] = await Promise.all([
          authFetch('/departments'),
          authFetch('/employees'),
        ]);

        if (!departmentsResponse.ok) {
          throw new Error(
            'Unable to load departments.',
          );
        }

        const departmentsPayload =
          await departmentsResponse.json();

        setDepartments(
          unwrapArray<Department>(
            departmentsPayload,
          ),
        );

        if (employeesResponse.ok) {
          const employeesPayload =
            await employeesResponse.json();

          setEmployees(
            unwrapArray<Employee>(
              employeesPayload,
            ),
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load departments.',
        );
      } finally {
        setLoading(false);
      }
    }, [authFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredDepartments =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return departments;
      }

      return departments.filter(
        (department) =>
          [
            department.name,
            department.head
              ?.fullName ?? '',
          ].some((value) =>
            value
              .toLowerCase()
              .includes(query),
          ),
      );
    }, [departments, search]);

  const requestJson = async <T,>(
    path: string,
    options: RequestInit,
    fallback: string,
  ): Promise<T> => {
    const response = await authFetch(
      path,
      options,
    );

    let payload: unknown = null;

    try {
      payload =
        await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          payload,
          fallback,
        ),
      );
    }

    return payload as T;
  };

  const openCreate = () => {
    setSelectedDepartment(null);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (
    department: Department,
  ) => {
    setSelectedDepartment(
      department,
    );
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setSelectedDepartment(null);
    setError('');
  };

  const saveDepartment = async (
    payload: {
      name: string;
      head: PersonDraft | null;
      members: PersonDraft[];
      isActive: boolean;
    },
  ) => {
    if (!canManage) return;

    setSaving(true);
    setError('');

    const toPersonPayload = (
      person: PersonDraft,
    ) =>
      person.employeeId
        ? {
            employeeId:
              person.employeeId,
          }
        : {
            fullName:
              person.name.trim(),
            email:
              person.email
                ?.trim() || undefined,
            phone:
              person.phone
                ?.trim() || undefined,
            username:
              person.username
                ?.trim() || undefined,
            temporaryPassword:
              person.temporaryPassword ||
              undefined,
          };

    try {
      await requestJson<Department>(
        selectedDepartment
          ? `/departments/${selectedDepartment.id}`
          : '/departments',
        {
          method: selectedDepartment
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            name: payload.name,
            head: payload.head
              ? toPersonPayload(
                  payload.head,
                )
              : null,
            members:
              payload.members.map(
                toPersonPayload,
              ),
            ...(selectedDepartment
              ? {
                  isActive:
                    payload.isActive,
                }
              : {}),
          }),
        },
        selectedDepartment
          ? 'Department update failed.'
          : 'Department creation failed.',
      );

      setModalOpen(false);
      setSelectedDepartment(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save department.',
      );
    } finally {
      setSaving(false);
    }
  };

  const removeDepartment = async (
    department: Department,
  ) => {
    if (!canManage) return;

    const confirmed =
      await appDialog.confirm({
        title: 'Remove department',
        message: `Remove ${department.name}?`,
        confirmLabel: 'Remove',
        tone: 'danger',
      });

    if (!confirmed) return;

    try {
      await requestJson(
        `/departments/${department.id}`,
        {
          method: 'DELETE',
        },
        'Department removal failed.',
      );

      await loadData();
    } catch (err) {
      await appDialog.alert({
        title: 'Department removal failed',
        message:
          err instanceof Error
            ? err.message
            : 'Department removal failed.',
      });
    }
  };

  const saveEmployeeLogin = async (
    payload: {
      username: string;
      email?: string;
      phone?: string;
      temporaryPassword?: string;
      isActive: boolean;
    },
  ) => {
    if (
      !canManage ||
      !loginEmployee
    ) {
      return;
    }

    const isPendingHrLogin =
      !loginEmployee.user.isActive &&
      loginEmployee.employeeId.startsWith(
        'HRP-',
      );

    setLoginSaving(true);
    setLoginError('');

    try {
      await requestJson<Employee>(
        isPendingHrLogin
          ? `/employees/${loginEmployee.id}/activate-login`
          : `/employees/${loginEmployee.id}/login`,
        {
          method: isPendingHrLogin
            ? 'POST'
            : 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            username:
              payload.username.trim(),
            ...(payload.email?.trim()
              ? {
                  email:
                    payload.email
                      .trim()
                      .toLowerCase(),
                }
              : {}),
            ...(payload.phone?.trim()
              ? {
                  phone:
                    payload.phone.trim(),
                }
              : {}),
            ...(payload.temporaryPassword?.trim()
              ? {
                  temporaryPassword:
                    payload.temporaryPassword.trim(),
                }
              : {}),
            ...(!isPendingHrLogin
              ? {
                  isActive:
                    payload.isActive,
                }
              : {}),
          }),
        },
        isPendingHrLogin
          ? 'Login creation failed.'
          : 'Login update failed.',
      );

      setLoginEmployee(null);
      await loadData();
    } catch (err) {
      setLoginError(
        err instanceof Error
          ? err.message
          : 'Unable to save login details.',
      );
    } finally {
      setLoginSaving(false);
    }
  };

  const detailMembers = useMemo(
    () => {
      if (!detailDepartment) {
        return [];
      }

      return employees.filter(
        (employee) =>
          employee.departmentId ===
          detailDepartment.id,
      );
    },
    [
      detailDepartment,
      employees,
    ],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Departments
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void loadData()
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-4 w-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </button>

          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Create Department
            </button>
          ) : null}
        </div>
      </div>

      {error && !modalOpen ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search departments"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading departments...
          </div>
        ) : filteredDepartments.length ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDepartments.map(
              (department) => {
                const members =
                  employees.filter(
                    (employee) =>
                      employee.departmentId ===
                      department.id,
                  );

                return (
                  <article
                    key={department.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-indigo-600" />
                          <h2 className="truncate font-black text-slate-950">
                            {department.name}
                          </h2>
                        </div>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            department.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {department.isActive
                            ? 'ACTIVE'
                            : 'INACTIVE'}
                        </span>
                      </div>

                      {canManage ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              openEdit(
                                department,
                              )
                            }
                            title="Manage Department"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Edit3 className="h-4 w-4" />
                            Manage
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void removeDepartment(
                                department,
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Department HOD
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {department.head
                          ?.fullName ||
                          'Not assigned'}
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-100 p-3 text-center">
                      <p className="text-xl font-black text-slate-900">
                        {members.length}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Team Members
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDetailDepartment(
                          department,
                        )
                      }
                      className="mt-4 flex w-full items-center justify-between rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      {canManage
                        ? 'Team & Logins'
                        : 'View Department Team'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <div className="p-10 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              No departments found.
            </p>
          </div>
        )}
      </section>

      {modalOpen ? (
        <DepartmentModal
          department={
            selectedDepartment
          }
          employees={employees}
          saving={saving}
          error={error}
          onClose={closeModal}
          onSubmit={
            saveDepartment
          }
        />
      ) : null}

      {detailDepartment ? (
        <DepartmentTeamModal
          department={
            detailDepartment
          }
          members={detailMembers}
          canManage={canManage}
          onManageLogin={(employee) => {
            setLoginError('');
            setLoginEmployee(employee);
          }}
          onClose={() =>
            setDetailDepartment(
              null,
            )
          }
        />
      ) : null}

      {loginEmployee ? (
        <EmployeeLoginModal
          employee={loginEmployee}
          saving={loginSaving}
          error={loginError}
          onClose={() => {
            if (loginSaving) return;
            setLoginEmployee(null);
            setLoginError('');
          }}
          onSubmit={saveEmployeeLogin}
        />
      ) : null}
    </div>
  );
}

function DepartmentModal({
  department,
  employees,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  department: Department | null;
  employees: Employee[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    head: PersonDraft | null;
    members: PersonDraft[];
    isActive: boolean;
  }) => void;
}) {
  const initialHead =
    department?.head
      ? {
          key: `existing-${department.head.id}`,
          name:
            department.head
              .fullName,
          employeeId:
            department.head.id,
        }
      : null;

  const initialMembers =
    employees
      .filter(
        (employee) =>
          employee.departmentId ===
            department?.id &&
          employee.id !==
            department?.headId,
      )
      .map((employee) => ({
        key: `existing-${employee.id}`,
        name: employee.fullName,
        employeeId:
          employee.id,
      }));

  const [name, setName] =
    useState(
      department?.name ?? '',
    );
  const [head, setHead] =
    useState<PersonDraft | null>(
      initialHead,
    );
  const [members, setMembers] =
    useState<PersonDraft[]>(
      initialMembers,
    );
  const [
    isActive,
    setIsActive,
  ] = useState(
    department?.isActive ?? true,
  );
  const [
    formError,
    setFormError,
  ] = useState('');

  const validateNewPerson = (
    person: PersonDraft,
  ) => {
    if (person.employeeId) {
      return '';
    }

    if (
      !person.email?.trim() &&
      !person.phone?.trim()
    ) {
      return `${person.name}: email or phone is required.`;
    }

    if (
      !person.username?.trim() ||
      person.username
        .replace(/^@+/, '')
        .trim().length < 3
    ) {
      return `${person.name}: username is required.`;
    }

    if (
      (
        person.temporaryPassword ??
        ''
      ).length < 8
    ) {
      return `${person.name}: temporary password must contain at least 8 characters.`;
    }

    return '';
  };

  const submit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const cleanName =
      name.trim();

    if (!cleanName) return;

    const people = [
      ...(head ? [head] : []),
      ...members,
    ];

    for (const person of people) {
      const message =
        validateNewPerson(person);

      if (message) {
        setFormError(message);
        return;
      }
    }

    setFormError('');

    onSubmit({
      name: cleanName,
      head,
      members,
      isActive,
    });
  };

  const updateMember = (
    key: string,
    patch: Partial<PersonDraft>,
  ) => {
    setMembers((current) =>
      current.map((member) =>
        member.key === key
          ? {
              ...member,
              ...patch,
            }
          : member,
      ),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <h2 className="text-xl font-black text-slate-950">
            {department
              ? 'Manage Department'
              : 'Create Department'}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {error || formError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {formError || error}
            </div>
          ) : null}

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Department Name
            </span>
            <input
              required
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="Department name"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>

          <PersonNameInput
            label="HOD Name"
            placeholder="Type HOD name"
            employees={employees}
            value={head}
            onChange={setHead}
            single
          />

          {head?.employeeId ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Existing account selected. The same login will be used and this department will be added as an additional HOD responsibility. No new password is required.
            </div>
          ) : null}

          {head &&
          !head.employeeId ? (
            <LoginFields
              person={head}
              onChange={(patch) =>
                setHead((current) =>
                  current
                    ? {
                        ...current,
                        ...patch,
                      }
                    : current,
                )
              }
            />
          ) : null}

          <details className="rounded-xl border border-slate-200 bg-slate-50/60">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700">
              Team Members {members.length ? `(${members.length})` : ''}
            </summary>
            <div className="space-y-4 border-t border-slate-200 p-4">
              <PersonNameInput
                label="Team Members"
                placeholder="Type member name and press Enter"
                employees={employees}
                values={members}
                onValuesChange={setMembers}
              />

              {members
                .filter((member) => !member.employeeId)
                .map((member) => (
                  <div
                    key={member.key}
                    className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{member.name}</p>
                        <p className="text-xs font-bold text-indigo-600">New Team Member</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setMembers((current) =>
                            current.filter((item) => item.key !== member.key),
                          )
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <LoginFields
                      person={member}
                      onChange={(patch) => updateMember(member.key, patch)}
                    />
                  </div>
                ))}
            </div>
          </details>

          {department ? (
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(
                    event.target
                      .checked,
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm font-semibold text-slate-700">
                Department is active
              </span>
            </label>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !name.trim()
            }
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving
              ? 'Saving...'
              : department
                ? 'Save Department'
                : 'Create Department'}
          </button>
        </div>
      </form>
    </div>
  );
}

function LoginFields({
  person,
  onChange,
}: {
  person: PersonDraft;
  onChange: (
    patch: Partial<PersonDraft>,
  ) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Email
        </span>
        <input
          type="email"
          value={
            person.email ?? ''
          }
          onChange={(event) =>
            onChange({
              email:
                event.target.value,
            })
          }
          placeholder="Email"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />
      </label>

      <label>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Phone
        </span>
        <input
          value={
            person.phone ?? ''
          }
          onChange={(event) =>
            onChange({
              phone:
                event.target.value,
            })
          }
          placeholder="Phone number"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />
      </label>

      <label>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Username
        </span>
        <input
          required
          value={
            person.username ?? ''
          }
          onChange={(event) =>
            onChange({
              username:
                event.target.value,
            })
          }
          placeholder="Username"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />
      </label>

      <label>
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Temporary Password
        </span>
        <input
          required
          minLength={8}
          type="password"
          value={
            person.temporaryPassword ??
            ''
          }
          onChange={(event) =>
            onChange({
              temporaryPassword:
                event.target.value,
            })
          }
          placeholder="Temporary password"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />
      </label>
    </div>
  );
}

function PersonNameInput({
  label,
  placeholder,
  employees,
  value,
  onChange,
  values = [],
  onValuesChange,
  single = false,
}: {
  label: string;
  placeholder: string;
  employees: Employee[];
  value?: PersonDraft | null;
  onChange?: (
    value: PersonDraft | null,
  ) => void;
  values?: PersonDraft[];
  onValuesChange?: (
    values: PersonDraft[],
  ) => void;
  single?: boolean;
}) {
  const [input, setInput] =
    useState(
      single
        ? value?.name ?? ''
        : '',
    );
  const [focused, setFocused] =
    useState(false);

  const selectedIds = new Set(
    values
      .map(
        (item) =>
          item.employeeId,
      )
      .filter(Boolean),
  );

  const suggestions =
    employees
      .filter(
        (employee) =>
          employee.employmentStatus !==
            'RESIGNED' &&
          employee.user.isActive,
      )
      .filter((employee) => {
        const query =
          input
            .trim()
            .toLowerCase();

        if (!query) return false;

        if (
          selectedIds.has(
            employee.id,
          )
        ) {
          return false;
        }

        if (
          single &&
          value?.employeeId ===
            employee.id
        ) {
          return false;
        }

        return (
          employee.fullName
            .toLowerCase()
            .includes(query) ||
          employee.employeeId
            .toLowerCase()
            .includes(query) ||
          (
            employee.username ??
            ''
          )
            .toLowerCase()
            .includes(query)
        );
      })
      .slice(0, 6);

  const addNewName = () => {
    const name = input
      .trim()
      .replace(/\s+/g, ' ');

    if (!name) return;

    const normalizedName =
      name.toLowerCase();

    const exactExisting =
      employees.find(
        (employee) =>
          employee.employmentStatus !==
            'RESIGNED' &&
          employee.user.isActive &&
          (employee.fullName
            .trim()
            .toLowerCase() ===
            normalizedName ||
            employee.employeeId
              .trim()
              .toLowerCase() ===
              normalizedName ||
            (employee.username ?? '')
              .replace(/^@+/, '')
              .trim()
              .toLowerCase() ===
              normalizedName.replace(/^@+/, '')),
      );

    if (exactExisting) {
      const token: PersonDraft = {
        key: `existing-${exactExisting.id}`,
        name: exactExisting.fullName,
        employeeId: exactExisting.id,
      };

      if (single) {
        onChange?.(token);
        setInput(exactExisting.fullName);
      } else if (!selectedIds.has(exactExisting.id)) {
        onValuesChange?.([
          ...values,
          token,
        ]);
        setInput('');
      }

      setFocused(false);
      return;
    }

    if (single) {
      onChange?.({
        ...(value &&
        !value.employeeId
          ? value
          : {}),
        key:
          value &&
          !value.employeeId
            ? value.key
            : `new-${Date.now()}`,
        name,
        employeeId:
          undefined,
      });
      setInput(name);
      setFocused(false);
      return;
    }

    const duplicate =
      values.some(
        (item) =>
          item.name.toLowerCase() ===
          name.toLowerCase(),
      );

    if (!duplicate) {
      onValuesChange?.([
        ...values,
        {
          key: `new-${Date.now()}-${Math.random()}`,
          name,
        },
      ]);
    }

    setInput('');
    setFocused(false);
  };

  const selectEmployee = (
    employee: Employee,
  ) => {
    const token: PersonDraft = {
      key: `existing-${employee.id}`,
      name: employee.fullName,
      employeeId:
        employee.id,
    };

    if (single) {
      onChange?.(token);
      setInput(
        employee.fullName,
      );
    } else {
      onValuesChange?.([
        ...values,
        token,
      ]);
      setInput('');
    }

    setFocused(false);
  };

  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <div className="relative mt-2">
        <div className="flex gap-2">
          <input
            value={input}
            onFocus={() =>
              setFocused(true)
            }
            onBlur={() =>
              window.setTimeout(
                () =>
                  setFocused(false),
                120,
              )
            }
            onChange={(event) => {
              const nextValue =
                event.target.value;

              setInput(nextValue);

              if (single) {
                const clean =
                  nextValue
                    .trim()
                    .replace(
                      /\s+/g,
                      ' ',
                    );

                if (!clean) {
                  onChange?.(null);
                  return;
                }

                const normalizedClean =
                  clean.toLowerCase();

                const exactEmployee =
                  employees.find(
                    (employee) =>
                      employee.employmentStatus !==
                        'RESIGNED' &&
                      employee.user.isActive &&
                      (employee.fullName
                        .trim()
                        .toLowerCase() ===
                        normalizedClean ||
                        employee.employeeId
                          .trim()
                          .toLowerCase() ===
                          normalizedClean ||
                        (employee.username ?? '')
                          .replace(/^@+/, '')
                          .trim()
                          .toLowerCase() ===
                          normalizedClean.replace(/^@+/, '')),
                  );

                if (exactEmployee) {
                  onChange?.({
                    key: `existing-${exactEmployee.id}`,
                    name: exactEmployee.fullName,
                    employeeId: exactEmployee.id,
                  });
                  return;
                }

                if (
                  value?.employeeId
                ) {
                  onChange?.({
                    key: `new-${Date.now()}`,
                    name: clean,
                  });
                } else {
                  onChange?.({
                    ...(value ?? {
                      key: `new-${Date.now()}`,
                    }),
                    name: clean,
                  } as PersonDraft);
                }
              }
            }}
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                  'Enter' ||
                event.key === ','
              ) {
                event.preventDefault();
                addNewName();
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />

          {!single ? (
            <button
              type="button"
              onClick={
                addNewName
              }
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          ) : null}
        </div>

        {focused &&
        input.trim() ? (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {suggestions.map(
              (employee) => (
                <button
                  type="button"
                  key={employee.id}
                  onMouseDown={(
                    event,
                  ) =>
                    event.preventDefault()
                  }
                  onClick={() =>
                    selectEmployee(
                      employee,
                    )
                  }
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {
                        employee.fullName
                      }
                    </p>
                    <p className="text-xs text-slate-500">
                      {
                        employee.employeeId
                      }
                      {employee.username
                        ? ` · @${employee.username}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-indigo-600">
                    Existing
                  </span>
                </button>
              ),
            )}

            <button
              type="button"
              onMouseDown={(
                event,
              ) =>
                event.preventDefault()
              }
              onClick={
                addNewName
              }
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <UserRoundPlus className="h-4 w-4" />
              Add “
              {input.trim()}”
            </button>
          </div>
        ) : null}
      </div>

      {!single &&
      values.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {values.map(
            (item) => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                  item.employeeId
                    ? 'border-slate-200 bg-slate-50 text-slate-700'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                }`}
              >
                {item.name}
                {!item.employeeId ? (
                  <span className="text-[9px] uppercase">
                    New
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    onValuesChange?.(
                      values.filter(
                        (valueItem) =>
                          valueItem.key !==
                          item.key,
                      ),
                    )
                  }
                  className="rounded-full p-0.5 hover:bg-black/5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

function DepartmentTeamModal({
  department,
  members,
  canManage,
  onManageLogin,
  onClose,
}: {
  department: Department;
  members: Employee[];
  canManage: boolean;
  onManageLogin: (
    employee: Employee,
  ) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              Department Team
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              {department.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {members.length ? (
            <div className="space-y-2">
              {members.map(
                (member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {
                            member.fullName
                          }
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {
                            member.employeeId
                          }
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          member.id ===
                          department.headId
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {member.id ===
                        department.headId
                          ? 'HOD'
                          : 'MEMBER'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          member.user.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : member.employeeId.startsWith('HRP-')
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {member.user.isActive
                          ? 'LOGIN ACTIVE'
                          : member.employeeId.startsWith('HRP-')
                            ? 'LOGIN PENDING'
                            : 'LOGIN INACTIVE'}
                      </span>

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() =>
                            onManageLogin(
                              member,
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          {member.user.isActive ||
                          !member.employeeId.startsWith('HRP-')
                            ? 'Manage Login'
                            : 'Create Login'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                No team members assigned.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmployeeLoginModal({
  employee,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  employee: Employee;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: {
    username: string;
    email?: string;
    phone?: string;
    temporaryPassword?: string;
    isActive: boolean;
  }) => void;
}) {
  const pendingHrLogin =
    !employee.user.isActive &&
    employee.employeeId.startsWith(
      'HRP-',
    );

  const [
    username,
    setUsername,
  ] = useState(
    employee.username ?? '',
  );
  const [email, setEmail] =
    useState(
      employee.user.email ?? '',
    );
  const [phone, setPhone] =
    useState(
      employee.user.phone ?? '',
    );
  const [
    temporaryPassword,
    setTemporaryPassword,
  ] = useState('');
  const [
    isActive,
    setIsActive,
  ] = useState(
    employee.user.isActive,
  );
  const [
    formError,
    setFormError,
  ] = useState('');

  const submit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !username
        .replace(/^@+/, '')
        .trim()
    ) {
      setFormError(
        'Username is required.',
      );
      return;
    }

    if (
      !email.trim() &&
      !phone.trim()
    ) {
      setFormError(
        'Email or phone number is required.',
      );
      return;
    }

    if (
      pendingHrLogin &&
      temporaryPassword.length < 8
    ) {
      setFormError(
        'Temporary password must contain at least 8 characters.',
      );
      return;
    }

    if (
      temporaryPassword &&
      temporaryPassword.length < 8
    ) {
      setFormError(
        'New password must contain at least 8 characters.',
      );
      return;
    }

    setFormError('');

    onSubmit({
      username:
        username
          .replace(/^@+/, '')
          .trim(),
      email:
        email.trim() ||
        undefined,
      phone:
        phone.trim() ||
        undefined,
      temporaryPassword:
        temporaryPassword ||
        undefined,
      isActive:
        pendingHrLogin
          ? true
          : isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {pendingHrLogin
                ? 'Create Workspace Login'
                : 'Manage Workspace Login'}
            </p>
            <h3 className="mt-1 text-lg font-black text-slate-950">
              {employee.fullName}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {(error ||
            formError) ? (
            <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {formError || error}
            </div>
          ) : null}

          <label>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Username
            </span>
            <input
              required
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value,
                )
              }
              placeholder="Username"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>

          <label>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value,
                )
              }
              placeholder="Email"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>

          <label>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Phone
            </span>
            <input
              value={phone}
              onChange={(event) =>
                setPhone(
                  event.target.value,
                )
              }
              placeholder="Phone number"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>

          <label>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {pendingHrLogin
                ? 'Temporary Password'
                : 'New Password'}
            </span>
            <input
              type="password"
              required={
                pendingHrLogin
              }
              minLength={8}
              value={
                temporaryPassword
              }
              onChange={(event) =>
                setTemporaryPassword(
                  event.target.value,
                )
              }
              placeholder={
                pendingHrLogin
                  ? 'Temporary password'
                  : 'Leave blank to keep current password'
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
            />
          </label>

          {!pendingHrLogin ? (
            <label className="sm:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-700">
                Login active
              </span>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(
                    event.target.checked,
                  )
                }
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {saving
              ? 'Saving...'
              : pendingHrLogin
                ? 'Create Login'
                : 'Save Login'}
          </button>
        </div>
      </form>
    </div>
  );
}
