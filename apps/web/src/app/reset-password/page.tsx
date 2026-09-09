'use client';

import {
  useEffect,
  useState,
} from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

export default function ResetPasswordPage() {
  const [token, setToken] =
    useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const tokenFromUrl =
      params.get('token');

    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, []);

  const submit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    setError('');

    if (
      newPassword !==
      confirmPassword
    ) {
      setError(
        'Passwords do not match.',
      );
      return;
    }

    if (newPassword.length < 8) {
      setError(
        'Password must contain at least 8 characters.',
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            token,
            newPassword,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ??
            'Password reset failed.',
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Password reset failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />

          <h1 className="mt-5 text-2xl font-bold">
            Password updated
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            You can now sign in with
            your new password.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white"
          >
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">
          Set new password
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 space-y-4"
        >
          <input
            value={token}
            onChange={(event) =>
              setToken(
                event.target.value,
              )
            }
            required
            placeholder="Reset token"
            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm"
          />

          <input
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
                event.target.value,
              )
            }
            required
            placeholder="New password"
            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value,
              )
            }
            required
            placeholder="Confirm password"
            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm"
          />

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            Reset password
          </button>
        </form>
      </div>
    </main>
  );
}