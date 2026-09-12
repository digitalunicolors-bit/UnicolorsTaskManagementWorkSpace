'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Bell,
  CheckCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  useAuth,
} from '@/components/auth/auth-provider';

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  redirectPath?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const {
    authFetch,
  } = useAuth();

  const router = useRouter();

  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const [open, setOpen] =
    useState(false);

  const [
    notifications,
    setNotifications,
  ] = useState<
    NotificationItem[]
  >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [loading, setLoading] =
    useState(false);

  const loadNotifications =
    useCallback(async () => {
      try {
        const [
          notificationsResponse,
          countResponse,
        ] = await Promise.all([
          authFetch(
            '/notifications',
          ),
          authFetch(
            '/notifications/unread-count',
          ),
        ]);

        if (
          notificationsResponse.ok
        ) {
          const result =
            await notificationsResponse.json();

          setNotifications(
            Array.isArray(result)
              ? result
              : Array.isArray(
                    result?.data,
                  )
                ? result.data
                : [],
          );
        }

        if (countResponse.ok) {
          const result =
            await countResponse.json();

          setUnreadCount(
            Number(
              result?.count ??
                result?.data?.count ??
                0,
            ),
          );
        }
      } catch {
        // Notification failure should
        // never break the workspace.
      }
    }, [authFetch]);

  useEffect(() => {
    void loadNotifications();

    const interval =
      window.setInterval(
        () => {
          void loadNotifications();
        },
        30000,
      );

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
    };
  }, []);

  const handleToggle =
    async () => {
      const nextOpen = !open;

      setOpen(nextOpen);

      if (nextOpen) {
        setLoading(true);

        await loadNotifications();

        setLoading(false);
      }
    };

  const markAsRead = async (
    item: NotificationItem,
  ) => {
    try {
      if (!item.isRead) {
        await authFetch(
          `/notifications/${item.id}/read`,
          {
            method: 'PATCH',
          },
        );
      }

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id ===
              item.id
                ? {
                    ...notification,
                    isRead: true,
                  }
                : notification,
          ),
      );

      if (!item.isRead) {
        setUnreadCount(
          (current) =>
            Math.max(
              0,
              current - 1,
            ),
        );
      }

      setOpen(false);

      if (item.redirectPath) {
        router.push(
          item.redirectPath,
        );
      }
    } catch {
      // Ignore individual
      // notification failure.
    }
  };

  const markAllAsRead =
    async () => {
      try {
        await authFetch(
          '/notifications/read-all',
          {
            method: 'PATCH',
          },
        );

        setNotifications(
          (current) =>
            current.map(
              (notification) => ({
                ...notification,
                isRead: true,
              }),
            ),
        );

        setUnreadCount(0);
      } catch {
        // Ignore failure and
        // keep current state.
      }
    };

  const formatDate = (
    value: string,
  ) => {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return '';
    }

    return date.toLocaleString(
      undefined,
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          void handleToggle()
        }
        aria-label="Notifications"
        className="relative rounded-xl border border-[#CFFAFE] bg-white/70 p-2.5 text-[#0F172A] transition hover:bg-white"
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-2xl border border-[#CFFAFE] bg-white shadow-2xl sm:w-[390px]">
          <div className="flex items-center justify-between border-b border-[#CFFAFE] px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Notifications
              </h3>

              <p className="mt-0.5 text-xs text-slate-500">
                {unreadCount === 0
                  ? 'You are all caught up'
                  : `${unreadCount} unread notification${
                      unreadCount ===
                      1
                        ? ''
                        : 's'
                    }`}
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  void markAllAsRead()
                }
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#0F172A] transition hover:bg-[#F9FAFB]"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[430px] overflow-y-auto">
            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                Loading notifications...
              </div>
            ) : notifications.length ===
              0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 text-sm font-semibold text-slate-700">
                  No notifications yet
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  New task updates will
                  appear here.
                </p>
              </div>
            ) : (
              notifications.map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      void markAsRead(
                        item,
                      )
                    }
                    className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50 ${
                      item.isRead
                        ? 'bg-white'
                        : 'bg-[#F9FAFB]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-1.5">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            item.isRead
                              ? 'bg-[#CFFAFE]'
                              : 'bg-[#0891B2]'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>

                          {!item.isRead && (
                            <span className="shrink-0 rounded-full bg-[#CFFAFE] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0F172A]">
                              New
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {item.message}
                        </p>

                        <p className="mt-2 text-[11px] text-slate-400">
                          {formatDate(
                            item.createdAt,
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                ),
              )
            )}
          </div>

          <div className="border-t border-[#CFFAFE] bg-[#F9FAFB] px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);

                router.push(
                  '/notifications',
                );
              }}
              className="w-full rounded-lg py-1.5 text-center text-xs font-semibold text-slate-700 transition hover:text-slate-950"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}