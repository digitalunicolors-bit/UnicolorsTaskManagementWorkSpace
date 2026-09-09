'use client';

import {
  useEffect,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import {
  useForm,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/components/auth/auth-provider';

const loginSchema = z.object({
  identifier: z
    .string()
    .min(
      1,
      'Phone, email or username is required.',
    ),

  password: z
    .string()
    .min(
      6,
      'Password must contain at least 6 characters.',
    ),
});

type LoginForm =
  z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();

  const {
    login,
    user,
    isLoading,
  } = useAuth();

  const [serverError, setServerError] =
    useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<LoginForm>({
    resolver:
      zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(
        user.mustChangePassword
          ? '/change-password'
          : '/dashboard',
      );
    }
  }, [
    isLoading,
    user,
    router,
  ]);

  const onSubmit = async (
    values: LoginForm,
  ) => {
    setServerError('');

    try {
      const loggedInUser =
        await login(values);

      router.replace(
        loggedInUser.mustChangePassword
          ? '/change-password'
          : '/dashboard',
      );
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Login failed.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700/30 via-slate-950 to-blue-700/20" />
        <div className="uc-login-orb absolute -left-24 top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="uc-login-orb absolute -right-20 bottom-20 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl [animation-delay:1.4s]" />

        <div className="uc-login-brand relative">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-lg font-black tracking-tight text-slate-950 shadow-lg shadow-black/10">
            <img
              src="/unicolors-mark.png"
              alt=""
              className="h-7 w-7 object-contain"
            />
            UNICOLORS
          </div>
        </div>

        <div className="uc-login-copy relative max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">
            Internal Workspace
          </p>

          <h1 className="text-5xl font-black leading-tight tracking-tight text-white">
            One workspace.
            <br />
            Every task.
            <br />
            Complete clarity.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
            Manage teams, clients,
            projects, approvals,
            deadlines and daily work
            from one place.
          </p>
        </div>

        <p className="uc-login-brand relative text-sm text-slate-500">
          Unicolors Private Limited
        </p>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="uc-login-card w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 font-black text-white">
              <img
                src="/unicolors-mark.png"
                alt=""
                className="h-6 w-6 object-contain"
              />
              UNICOLORS
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              Login
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Use your phone, email or
              username and password.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(
              onSubmit,
            )}
            className="space-y-5"
          >
            <div className="uc-login-field-1">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Phone / Email / Username
              </label>

              <input
                {...register(
                  'identifier',
                )}
                autoComplete="username"
                placeholder="Phone, email or username"
                className="uc-login-interactive w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
              />

              {errors.identifier && (
                <p className="mt-2 text-sm text-red-600">
                  {
                    errors.identifier
                      .message
                  }
                </p>
              )}
            </div>

            <div className="uc-login-field-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">
                  Password
                </label>

                <Link
                  href="/forgot-password"
                  className="text-sm font-semibold text-violet-700 hover:text-violet-900"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  {...register(
                    'password',
                  )}
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="uc-login-interactive w-full rounded-xl border border-slate-200 px-4 py-3.5 pr-12 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (value) => !value,
                    )
                  }
                  className="uc-login-interactive absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="mt-2 text-sm text-red-600">
                  {
                    errors.password
                      .message
                  }
                </p>
              )}
            </div>

            {serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="uc-login-action uc-login-interactive flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              Login
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Secure internal access only.
          </p>
        </div>
      </section>
    </main>
  );
}