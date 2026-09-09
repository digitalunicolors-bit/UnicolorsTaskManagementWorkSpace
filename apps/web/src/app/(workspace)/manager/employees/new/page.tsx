'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Loader2,
  UserPlus,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

type Department = {
  id: string;
  name: string;
  isActive?: boolean;
};

function getMessage(value: unknown, fallback: string) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value
  ) {
    const message = (
      value as { message?: string | string[] }
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

function unwrapList<T>(value: unknown): T[] {
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
      value as { data: T[] }
    ).data;
  }

  return [];
}

export default function AddHrEmployeePage() {
  const { authFetch } = useAuth();
  const [departments, setDepartments] =
    useState<Department[]>([]);
  const [loadingRoles, setLoadingRoles] =
    useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadDepartments = useCallback(async () => {
    setLoadingRoles(true);

    try {
      const response = await authFetch('/departments');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          getMessage(
            result,
            'Unable to load roles.',
          ),
        );
      }

      setDepartments(
        unwrapList<Department>(result).filter(
          (department) =>
            department.isActive !== false,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load roles.',
      );
    } finally {
      setLoadingRoles(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const departmentById = useMemo(
    () =>
      new Map(
        departments.map((department) => [
          department.id,
          department,
        ]),
      ),
    [departments],
  );

  const submit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(
      formData.get('fullName') ?? '',
    ).trim();
    const departmentId = String(
      formData.get('departmentId') ?? '',
    ).trim();
    const joinDate = String(
      formData.get('joinDate') ?? '',
    ).trim();
    const department =
      departmentById.get(departmentId);

    if (!fullName || !department || !joinDate) {
      setError(
        'Employee Name, Role and Join Date are required.',
      );
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await authFetch(
        '/employees/hr-join-requests',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fullName,
            role: department.name,
            departmentId: department.id,
            joinDate,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          getMessage(
            result,
            'Unable to add employee.',
          ),
        );
      }

      form.reset();
      setSuccess(
        `${fullName} added to ${department.name}. Super Admin and the department HOD have been notified. Workspace login is pending with Super Admin.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add employee.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          Add Employee
        </h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-950">
            New Employee
          </h2>
        </div>

        <form
          onSubmit={submit}
          className="grid gap-5 sm:grid-cols-2"
        >
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Employee Name
            </span>
            <input
              name="fullName"
              required
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Role
            </span>
            <select
              name="departmentId"
              required
              disabled={loadingRoles}
              defaultValue=""
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 disabled:opacity-60"
            >
              <option value="">
                {loadingRoles
                  ? 'Loading roles...'
                  : 'Select Role'}
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
          </label>

          <label>
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Join Date
            </span>
            <input
              name="joinDate"
              type="date"
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </label>

          <div className="sm:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving || loadingRoles}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Add Employee
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
