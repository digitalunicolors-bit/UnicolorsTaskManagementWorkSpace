'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
} from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface ForgotResponse {
  success: boolean;
  message: string;
  devResetToken?: string;
}

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [devToken, setDevToken] =
    useState('');

  const submit = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    setLoading(true);
    setError('');
    setMessage('');
    setDevToken('');

    try {
      const response = await fetch(
        `${API_URL}/auth/forgot-password`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            identifier,
          }),
        },
      );

      const data =
        (await response.json()) as
          ForgotResponse;

      if (!response.ok) {
        throw new Error(
          data.message ??
            'Request failed.',
        );
      }

      setMessage(data.message);

      if (data.devResetToken) {
        setDevToken(
          data.devResetToken,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Request failed.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/login"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-slate-950">
          Forgot password?
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter your registered email
          or phone number.
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5"
        >
          <input
            value={identifier}
            onChange={(event) =>
              setIdentifier(
                event.target.value,
              )
            }
            required
            placeholder="Email or phone"
            className="w-full rounded-xl border border-slate-200 px-4 py-3.5 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
          />

          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            Generate reset request
          </button>
        </form>

        {message && (
          <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {devToken && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Development only
            </p>

            <p className="mt-2 break-all text-xs text-amber-700">
              {devToken}
            </p>

            <Link
              href={`/reset-password?token=${encodeURIComponent(
                devToken,
              )}`}
              className="mt-4 inline-flex rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Continue to reset
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}   