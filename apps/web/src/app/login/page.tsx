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

type LoginForm = z.infer<
  typeof loginSchema
>;

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isLoading } =
    useAuth();

  const [serverError, setServerError] =
    useState('');
  const [showPassword, setShowPassword] =
    useState(false);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(
        user.mustChangePassword
          ? '/change-password'
          : '/dashboard',
      );
    }
  }, [isLoading, user, router]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F7F7F5] px-5 py-8">
      <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#EEE8FB] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-[#F0EBFA] blur-3xl" />

      <section className="uc-login-card relative z-10 w-full max-w-[430px] rounded-[20px] border border-[#E7E7E3] bg-white p-6 shadow-[0_20px_55px_rgba(36,36,36,0.07)] sm:p-8">
        <div className="mb-7">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EBFA] text-[#7C3AED]">
            <LockKeyhole className="h-5 w-5" />
          </div>

          <h1 className="text-[27px] font-black tracking-tight text-[#242424]">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-[#777773]">
            Sign in to Unicolors Workspace.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="uc-login-field-1">
            <label className="mb-1.5 block text-sm font-semibold text-[#42423F]">
              Phone / Email / Username
            </label>
            <input
              {...register('identifier')}
              autoComplete="username"
              placeholder="Enter phone, email or username"
              className="uc-login-interactive w-full rounded-xl border border-[#E2E1DE] bg-[#FAFAF9] px-4 py-3.5 text-sm text-[#242424] outline-none placeholder:text-[#A1A19D] focus:border-[#A78BFA] focus:bg-white focus:ring-4 focus:ring-[#7C3AED]/10"
            />
            {errors.identifier && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.identifier.message}
              </p>
            )}
          </div>

          <div className="uc-login-field-2">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-[#42423F]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9]"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative">
              <input
                {...register('password')}
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                autoComplete="current-password"
                placeholder="Enter password"
                className="uc-login-interactive w-full rounded-xl border border-[#E2E1DE] bg-[#FAFAF9] px-4 py-3.5 pr-12 text-sm text-[#242424] outline-none placeholder:text-[#A1A19D] focus:border-[#A78BFA] focus:bg-white focus:ring-4 focus:ring-[#7C3AED]/10"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value,
                  )
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#9A9A95] transition hover:bg-[#F1EBFA] hover:text-[#7C3AED]"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {errors.password && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="uc-login-action uc-login-interactive flex w-full items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-3.5 text-sm font-black text-white shadow-sm hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Login
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] font-medium text-[#A1A19D]">
          Unicolors Private Limited · Internal Workspace
        </p>
      </section>
    </main>
  );
}
