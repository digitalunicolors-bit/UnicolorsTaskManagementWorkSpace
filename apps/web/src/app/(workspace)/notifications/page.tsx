'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  AtSign,
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  FileUp,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Monitor,
  RefreshCw,
  Save,
  Settings2,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

interface ActorProfile {
  fullName?: string | null;
  username?: string | null;
  profileImageUrl?: string | null;
}

interface NotificationActor {
  id: string;
  email?: string | null;
  phone?: string | null;
  employeeProfile?: ActorProfile | null;
}

interface NotificationItem {
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
  actor?: NotificationActor | null;
}

interface Preferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  taskAssigned: boolean;
  taskReassigned: boolean;
  dueReminder: boolean;
  upcomingDeadline: boolean;
  overdueTask: boolean;
  commentAdded: boolean;
  userMentioned: boolean;
  fileUploaded: boolean;
  reviewUpdates: boolean;
  taskCompleted: boolean;
  projectDeadline: boolean;
  dailyDigestEnabled: boolean;
}

const defaultPreferences: Preferences = {
  inAppEnabled: true,
  emailEnabled: false,
  whatsappEnabled: true,
  taskAssigned: true,
  taskReassigned: true,
  dueReminder: true,
  upcomingDeadline: true,
  overdueTask: true,
  commentAdded: true,
  userMentioned: true,
  fileUploaded: true,
  reviewUpdates: true,
  taskCompleted: true,
  projectDeadline: true,
  dailyDigestEnabled: true,
};

function errorMessage(value: unknown, fallback: string) {
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

function timeAgo(value: string) {
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (!Number.isFinite(seconds)) {
    return value;
  }

  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleString();
}

function actorName(actor?: NotificationActor | null) {
  const profile = actor?.employeeProfile;

  if (profile?.fullName) {
    return profile.username
      ? `${profile.fullName} (@${profile.username})`
      : profile.fullName;
  }

  return actor?.email || actor?.phone || null;
}

function iconFor(kind: string) {
  if (kind.includes('OVERDUE')) return AlertTriangle;
  if (kind.includes('DUE') || kind.includes('DEADLINE')) return CalendarClock;
  if (kind === 'COMMENT_ADDED') return MessageSquare;
  if (kind === 'USER_MENTIONED') return AtSign;
  if (kind === 'FILE_UPLOADED') return FileUp;
  if (
    kind.includes('APPROVED') ||
    kind.includes('COMPLETED') ||
    kind.includes('REVIEW') ||
    kind.includes('CHANGES')
  ) {
    return ClipboardCheck;
  }
  if (kind.includes('DIGEST')) return Clock3;
  return Bell;
}

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-blue-600' : 'bg-slate-200'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { authFetch, hasPermission } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canRunReminders = hasPermission('tasks.view_all');

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await authFetch(path, init);
      let data: unknown | null = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(errorMessage(data, 'Request failed.'));
      }

      return data as T;
    },
    [authFetch],
  );

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }

      try {
        const [list, unread, prefs] = await Promise.all([
          request<NotificationItem[]>('/notifications?limit=100'),
          request<{ count: number }>('/notifications/unread-count'),
          request<Preferences>('/notifications/preferences'),
        ]);

        setNotifications(list);
        setUnreadCount(unread.count);
        setPreferences({ ...defaultPreferences, ...prefs });
      } catch (err) {
        if (!silent) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load notifications.',
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [request],
  );

  useEffect(() => {
    void loadData();

    const timer = setInterval(() => {
      void loadData(true);
    }, 30000);

    return () => clearInterval(timer);
  }, [loadData]);

  const visible = useMemo(
    () =>
      filter === 'unread'
        ? notifications.filter((item) => !item.isRead)
        : notifications,
    [filter, notifications],
  );

  const markRead = async (item: NotificationItem, navigate = false) => {
    setError('');

    try {
      if (!item.isRead) {
        await request(`/notifications/${item.id}/read`, {
          method: 'PATCH',
        });

        setNotifications((current) =>
          current.map((value) =>
            value.id === item.id
              ? { ...value, isRead: true }
              : value,
          ),
        );

        setUnreadCount((current) => Math.max(0, current - 1));
      }

      if (navigate && item.redirectPath) {
        router.push(item.redirectPath);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update notification.',
      );
    }
  };

  const markAllRead = async () => {
    setError('');

    try {
      await request('/notifications/read-all', {
        method: 'PATCH',
      });

      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
      setUnreadCount(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to mark notifications as read.',
      );
    }
  };

  const savePreferences = async () => {
    setSavingPreferences(true);
    setError('');
    setSuccess('');

    try {
      const result = await request<Preferences>('/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      setPreferences({ ...defaultPreferences, ...result });
      setSuccess('Notification preferences saved.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save preferences.',
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  const runReminderCheck = async () => {
    setRunningReminders(true);
    setError('');
    setSuccess('');

    try {
      const stats = await request<{
        dueToday: number;
        upcoming: number;
        overdue: number;
        projectDeadline: number;
        dailyDigest: number;
      }>('/notifications/run-reminders', {
        method: 'POST',
      });

      setSuccess(
        `Reminder check complete: ${stats.dueToday} due today, ${stats.upcoming} upcoming, ${stats.overdue} overdue, ${stats.projectDeadline} project deadline, ${stats.dailyDigest} digest notification(s) created.`,
      );

      await loadData(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to run reminder check.',
      );
    } finally {
      setRunningReminders(false);
    }
  };

  const preferenceRows: Array<{
    key: keyof Preferences;
    label: string;
    description: string;
  }> = [
    { key: 'taskAssigned', label: 'Task assignments', description: 'New and critical task assignments.' },
    { key: 'taskReassigned', label: 'Task reassignment', description: 'When responsibility for a task changes.' },
    { key: 'dueReminder', label: 'Due today', description: 'Reminder on the task due date.' },
    { key: 'upcomingDeadline', label: 'Upcoming deadlines', description: 'Tasks approaching their deadline.' },
    { key: 'overdueTask', label: 'Overdue tasks', description: 'Tasks that have crossed their deadline.' },
    { key: 'commentAdded', label: 'Comments', description: 'New task discussion messages.' },
    { key: 'userMentioned', label: '@Mentions', description: 'When a teammate mentions your username.' },
    { key: 'fileUploaded', label: 'Files & voice notes', description: 'New files, work submissions and voice notes.' },
    { key: 'reviewUpdates', label: 'Review & approval', description: 'Submitted for review, approved or changes requested.' },
    { key: 'taskCompleted', label: 'Task completed', description: 'Completion confirmation.' },
    { key: 'projectDeadline', label: 'Project deadlines', description: 'Project deadlines approaching soon.' },
    { key: 'dailyDigestEnabled', label: 'Daily task summary', description: 'A daily snapshot of due, overdue and upcoming tasks.' },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading notifications...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
            <Bell className="h-5 w-5 text-blue-600" />
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">
              Notifications
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canRunReminders && (
            <button
              type="button"
              onClick={() => void runReminderCheck()}
              disabled={runningReminders}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-50"
            >
              {runningReminders ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Run Reminder Check
            </button>
          )}

          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="font-black text-slate-950">Notification Center</h2>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  filter === 'all'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  filter === 'unread'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Unread
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {!visible.length ? (
              <div className="p-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-600">No notifications here.</p>
              </div>
            ) : (
              visible.map((item) => {
                const Icon = iconFor(item.kind);
                const actor = actorName(item.actor);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      void markRead(item, Boolean(item.redirectPath))
                    }
                    className={`flex w-full gap-4 p-5 text-left transition hover:bg-slate-50 ${
                      item.isRead ? '' : 'bg-blue-50/40'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        item.isRead
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={`text-sm ${
                            item.isRead
                              ? 'font-bold text-slate-800'
                              : 'font-black text-slate-950'
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="shrink-0 text-xs text-slate-400">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {item.message}
                      </p>

                      {actor && (
                        <p className="mt-2 text-xs font-semibold text-slate-400">
                          By {actor}
                        </p>
                      )}
                    </div>

                    {!item.isRead && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-violet-600" />
              <h2 className="font-black text-slate-950">Preferences</h2>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                Delivery Channels
              </p>

              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Monitor className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">In-App</p>
                      <p className="text-xs text-slate-400">Notification bell and center.</p>
                    </div>
                  </div>
                  <Toggle
                    checked={preferences.inAppEnabled}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        inAppEnabled: value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">Email</p>
                      <p className="text-xs text-slate-400">
                        Preference saved; SMTP delivery will be connected during deployment.
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={preferences.emailEnabled}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        emailEnabled: value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-800">WhatsApp</p>
                      <p className="text-xs text-slate-400">
                        Meta WhatsApp Cloud API delivery. Enable this to opt in to task reminders.
                      </p>
                    </div>
                  </div>
                  <Toggle
                    checked={preferences.whatsappEnabled}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        whatsappEnabled: value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {preferenceRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-800">{row.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-400">
                      {row.description}
                    </p>
                  </div>
                  <Toggle
                    checked={preferences[row.key]}
                    disabled={!preferences.inAppEnabled && !preferences.emailEnabled && !preferences.whatsappEnabled}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        [row.key]: value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void savePreferences()}
              disabled={savingPreferences}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {savingPreferences ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Preferences
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
