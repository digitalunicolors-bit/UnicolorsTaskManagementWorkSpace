'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Bell } from 'lucide-react';

import {
  useAuth,
} from '@/components/auth/auth-provider';

export function NotificationBell() {
  const { authFetch } = useAuth();
  const [unreadCount, setUnreadCount] =
    useState(0);

  const loadUnreadCount =
    useCallback(async () => {
      try {
        const response = await authFetch(
          '/notifications/unread-count',
        );

        if (!response.ok) {
          return;
        }

        const result = await response.json();

        setUnreadCount(
          Number(
            result?.count ??
              result?.data?.count ??
              0,
          ),
        );
      } catch {
        // Notification count must never
        // interrupt the workspace.
      }
    }, [authFetch]);

  useEffect(() => {
    void loadUnreadCount();

    const interval = window.setInterval(
      () => {
        void loadUnreadCount();
      },
      30_000,
    );

    return () =>
      window.clearInterval(interval);
  }, [loadUnreadCount]);

  return (
    <Link
      href="/notifications"
      aria-label="Open notifications"
      title="Notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E2DE] bg-white text-[#555551] shadow-sm transition hover:border-[#D8CCF4] hover:bg-[#F5F0FD] hover:text-[#7C3AED]"
    >
      <Bell className="h-4 w-4" />

      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#7C3AED] px-1 text-[9px] font-black leading-none text-white shadow-sm">
          {unreadCount > 99
            ? '99+'
            : unreadCount}
        </span>
      )}
    </Link>
  );
}
