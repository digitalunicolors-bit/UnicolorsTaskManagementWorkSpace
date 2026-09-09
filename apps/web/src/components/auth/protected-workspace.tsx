'use client';

import {
  useEffect,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  Loader2,
} from 'lucide-react';
import type {
  ReactNode,
} from 'react';
import {
  useAuth,
} from './auth-provider';
import {
  AppShell,
} from '../workspace/app-shell';
export function ProtectedWorkspace({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const {
    user,
    isLoading,
  } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
      return;
    }

    if (
      !isLoading &&
      user?.mustChangePassword
    ) {
      router.replace('/change-password');
    }
  }, [
    isLoading,
    user,
    router,
  ]);

  if (
    isLoading ||
    !user ||
    user.mustChangePassword
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
      </div>
    );
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
}