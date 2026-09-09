'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';

export default function ChangePasswordPage() {
  const router = useRouter();

  const {
    user,
    isLoading,
    authFetch,
    logout,
  } = useAuth();

  const [currentPassword, setCurrentPassword] =
    useState('');
  const [newPassword, setNewPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');
  const [showCurrent, setShowCurrent] =
    useState(false);
  const [showNew, setShowNew] =
    useState(false);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!user.mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [
    isLoading,
    user,
    router,
  ]);

  const submit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError(
        'New password must contain at least 8 characters.',
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        'New passwords do not match.',
      );
      return;
    }

    setSaving(true);

    try {
      const response = await authFetch(
        '/auth/change-password',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message =
          Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message;

        throw new Error(
          message ??
            'Unable to change password.',
        );
      }

      await logout();
      router.replace('/login');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change password.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (
    isLoading ||
    !user ||
    !user.mustChangePassword
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <LockKeyhole className="h-5 w-5" />
        </div>

        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          Change password
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5"
        >
          <PasswordField
            label="Temporary Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() =>
              setShowCurrent(
                (value) => !value,
              )
            }
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() =>
              setShowNew(
                (value) => !value,
              )
            }
          />

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Confirm New Password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Save New Password
          </button>
        </form>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          required
          autoComplete={
            label === 'New Password'
              ? 'new-password'
              : 'current-password'
          }
          className="w-full rounded-xl border border-slate-200 px-4 py-3.5 pr-12 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
        >
          {show ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
    </label>
  );
}
