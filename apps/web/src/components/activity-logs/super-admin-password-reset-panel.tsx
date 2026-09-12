'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Search,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { appDialog } from '@/components/ui/app-dialog-provider';

type Employee = {
  id: string;
  employeeId: string;
  username?: string | null;
  fullName: string;
  designation?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    isActive: boolean;
    email?: string | null;
    phone?: string | null;
    roles?: {
      role: {
        name: string;
      };
    }[];
  };
};

type ResetResult = {
  userId: string;
  employeeId: string;
  fullName: string;
  username?: string | null;
  roles: string[];
  temporaryPassword: string;
  mustChangePassword: boolean;
  sessionsRevoked: boolean;
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

export function SuperAdminPasswordResetPanel() {
  const { user, authFetch } = useAuth();
  const isSuperAdmin = Boolean(
    user?.roles?.includes('SUPER_ADMIN'),
  );

  const [employees, setEmployees] =
    useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [resettingId, setResettingId] =
    useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] =
    useState<ResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!isSuperAdmin) return;

    setLoading(true);
    setError('');

    try {
      const response = await authFetch('/employees');
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          getMessage(
            json,
            'Unable to load users for password reset.',
          ),
        );
      }

      setEmployees(unwrapList<Employee>(json));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load users for password reset.',
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch, isSuperAdmin]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const resettableEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    const allowed = new Set([
      'EMPLOYEE',
      'MANAGER',
      'ADMIN',
    ]);

    return employees.filter((employee) => {
      const roles =
        employee.user.roles?.map(
          (item) => item.role.name,
        ) ?? [];

      if (
        !employee.user.isActive ||
        roles.includes('SUPER_ADMIN') ||
        !roles.some((role) => allowed.has(role))
      ) {
        return false;
      }

      if (!query) return true;

      return [
        employee.fullName,
        employee.employeeId,
        employee.username,
        employee.designation,
        employee.department?.name,
        ...roles,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        );
    });
  }, [employees, search]);

  const resetPassword = async (employee: Employee) => {
    const confirmed = await appDialog.confirm({
      title: 'Reset password',
      message: `Reset password for ${employee.fullName}?\n\nTheir current sessions will be logged out and a new temporary password will be generated.`,
      confirmLabel: 'Reset password',
      tone: 'danger',
    });

    if (!confirmed) return;

    setResettingId(employee.user.id);
    setError('');
    setResult(null);
    setCopied(false);

    try {
      const response = await authFetch(
        `/employees/admin-password-reset/${employee.user.id}`,
        {
          method: 'POST',
        },
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          getMessage(
            json,
            'Password reset failed.',
          ),
        );
      }

      setResult(json as ResetResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Password reset failed.',
      );
    } finally {
      setResettingId(null);
    }
  };

  const copyPassword = async () => {
    if (!result?.temporaryPassword) return;

    try {
      await navigator.clipboard.writeText(
        result.temporaryPassword,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-black text-slate-950">
              Login History · Password Reset
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Super Admin only · Team Member, Manager/HOD and Admin accounts
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search member..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-300"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            Temporary password generated for {result.fullName}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-slate-950 ring-1 ring-emerald-200">
              {result.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            All existing sessions were revoked. The member must change this password after login.
          </p>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts...
          </div>
        ) : resettableEmployees.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No matching resettable accounts.
          </div>
        ) : (
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {resettableEmployees.map((employee) => {
              const roles =
                employee.user.roles?.map(
                  (item) => item.role.name,
                ) ?? [];

              return (
                <div
                  key={employee.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {employee.fullName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {employee.employeeId}
                      {employee.username
                        ? ` · @${employee.username}`
                        : ''}
                      {employee.department?.name
                        ? ` · ${employee.department.name}`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-violet-700">
                      {roles.join(' · ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      resettingId === employee.user.id
                    }
                    onClick={() =>
                      void resetPassword(employee)
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {resettingId === employee.user.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    Reset Password
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
