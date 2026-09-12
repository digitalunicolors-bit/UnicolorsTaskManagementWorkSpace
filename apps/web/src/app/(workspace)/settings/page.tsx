'use client';

import {
  CalendarClock,
  Check,
  Languages,
  Monitor,
  Moon,
  RefreshCcw,
  Sun,
  BriefcaseBusiness,
  ShieldCheck,
  Plus,
  Pencil,
  UserMinus,
  X,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { appDialog } from '@/components/ui/app-dialog-provider';

import {
  type DateFormatPreference,
  type LanguagePreference,
  type ThemePreference,
  type TimeFormatPreference,
  type TimeZonePreference,
  formatWorkspaceDateTime,
  useWorkspacePreferences,
} from '@/components/workspace/workspace-preferences';

const copy = {
  en: {
    title: 'Settings',
    subtitle:
      'Personalise how Unicolors Workspace looks and displays information on this device.',
    display: 'Display',
    displayHelp:
      'Choose the workspace appearance and motion preferences.',
    theme: 'Theme',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    reducedMotion: 'Reduce motion',
    reducedMotionHelp:
      'Minimises interface transitions and animations.',
    language: 'Language',
    languageHelp:
      'Changes workspace navigation and Settings labels.',
    dateTime: 'Date & Time',
    dateTimeHelp:
      'Set your preferred date, clock and timezone display.',
    dateFormat: 'Date format',
    timeFormat: 'Time format',
    timeZone: 'Time zone',
    showHeaderDateTime:
      'Show date & time in header',
    preview: 'Live preview',
    saved: 'Saved',
    reset: 'Reset to defaults',
    instant:
      'Preferences are saved automatically in this browser.',
  },
  hi: {
    title: 'सेटिंग्स',
    subtitle:
      'इस डिवाइस पर Unicolors Workspace का रूप और जानकारी का प्रदर्शन चुनें।',
    display: 'डिस्प्ले',
    displayHelp:
      'वर्कस्पेस की थीम और मोशन विकल्प चुनें।',
    theme: 'थीम',
    system: 'सिस्टम',
    light: 'लाइट',
    dark: 'डार्क',
    reducedMotion: 'मोशन कम करें',
    reducedMotionHelp:
      'इंटरफेस ट्रांज़िशन और एनीमेशन कम करता है।',
    language: 'भाषा',
    languageHelp:
      'वर्कस्पेस नेविगेशन और सेटिंग्स के लेबल बदलता है।',
    dateTime: 'तारीख और समय',
    dateTimeHelp:
      'तारीख, घड़ी और टाइम ज़ोन का प्रारूप चुनें।',
    dateFormat: 'तारीख का प्रारूप',
    timeFormat: 'समय का प्रारूप',
    timeZone: 'टाइम ज़ोन',
    showHeaderDateTime:
      'हेडर में तारीख और समय दिखाएँ',
    preview: 'लाइव प्रीव्यू',
    saved: 'सेव हो गया',
    reset: 'डिफ़ॉल्ट पर रीसेट करें',
    instant:
      'सेटिंग्स इस ब्राउज़र में अपने आप सेव होती हैं।',
  },
  gu: {
    title: 'સેટિંગ્સ',
    subtitle:
      'આ ડિવાઇસ પર Unicolors Workspace કેવી રીતે દેખાય અને માહિતી બતાવે તે પસંદ કરો.',
    display: 'ડિસ્પ્લે',
    displayHelp:
      'વર્કસ્પેસની થીમ અને મોશન પસંદગીઓ પસંદ કરો.',
    theme: 'થીમ',
    system: 'સિસ્ટમ',
    light: 'લાઇટ',
    dark: 'ડાર્ક',
    reducedMotion: 'મોશન ઘટાડો',
    reducedMotionHelp:
      'ઇન્ટરફેસ ટ્રાન્ઝિશન અને એનિમેશન ઘટાડે છે.',
    language: 'ભાષા',
    languageHelp:
      'વર્કસ્પેસ નેવિગેશન અને સેટિંગ્સના લેબલ બદલે છે.',
    dateTime: 'તારીખ અને સમય',
    dateTimeHelp:
      'તારીખ, ઘડિયાળ અને ટાઇમ ઝોનનું ફોર્મેટ પસંદ કરો.',
    dateFormat: 'તારીખનું ફોર્મેટ',
    timeFormat: 'સમયનું ફોર્મેટ',
    timeZone: 'ટાઇમ ઝોન',
    showHeaderDateTime:
      'હેડરમાં તારીખ અને સમય બતાવો',
    preview: 'લાઇવ પ્રિવ્યૂ',
    saved: 'સેવ થયું',
    reset: 'ડિફૉલ્ટ પર રીસેટ કરો',
    instant:
      'પસંદગીઓ આ બ્રાઉઝરમાં આપમેળે સેવ થાય છે.',
  },
} as const;

const themeOptions: {
  value: ThemePreference;
  icon: typeof Monitor;
}[] = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

const languages: {
  value: LanguagePreference;
  label: string;
}[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'gu', label: 'ગુજરાતી' },
];

const dateFormats: DateFormatPreference[] = [
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
];

const timeZones: {
  value: TimeZonePreference;
  label: string;
}[] = [
  {
    value: 'Asia/Kolkata',
    label: 'Ahmedabad, India (IST)',
  },
  { value: 'UTC', label: 'UTC' },
  {
    value: 'Asia/Dubai',
    label: 'Dubai — Asia/Dubai',
  },
  {
    value: 'Europe/London',
    label: 'London — Europe/London',
  },
  {
    value: 'America/New_York',
    label: 'New York — America/New_York',
  },
];

type SettingsIdentity = {
  department?: {
    id: string;
    name: string;
  } | null;
  managedDepartments?: Array<{
    id: string;
    name: string;
  }>;
};

type ClientOption = {
  id: string;
  name: string;
  companyName?: string | null;
  isActive: boolean;
};

type SuperAdminRecord = {
  id: string;
  employeeId: string;
  username?: string | null;
  fullName: string;
  designation?: string | null;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt?: string | null;
  };
};

type TeamMemberRecord = {
  id: string;
  employeeId: string;
  username?: string | null;
  fullName: string;
  designation?: string | null;
  employmentStatus?: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  user: {
    id: string;
    isActive: boolean;
    roles: Array<{
      role: {
        id: string;
        name: string;
      };
    }>;
  };
};

export default function SettingsPage() {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
  } = useWorkspacePreferences();

  const {
    user,
    authFetch,
  } = useAuth();

  const text =
    copy[preferences.language];

  const [identity, setIdentity] =
    useState<SettingsIdentity | null>(null);

  const [clients, setClients] =
    useState<ClientOption[]>([]);

  const [closingClientId, setClosingClientId] =
    useState('');

  const [superAdmins, setSuperAdmins] =
    useState<SuperAdminRecord[]>([]);

  const [teamMembers, setTeamMembers] =
    useState<TeamMemberRecord[]>([]);

  const [removingMemberId, setRemovingMemberId] =
    useState('');

  const [removeMemberBusy, setRemoveMemberBusy] =
    useState(false);

  const [showAddSuperAdmin, setShowAddSuperAdmin] =
    useState(false);

  const [manageSuperAdmin, setManageSuperAdmin] =
    useState<SuperAdminRecord | null>(null);

  const [accountBusy, setAccountBusy] =
    useState(false);

  const [now, setNow] =
    useState(() => new Date());
  const [saved, setSaved] =
    useState(false);

  const isSuperAdmin =
    Boolean(
      user?.roles?.includes('SUPER_ADMIN'),
    );

  const normalizedDepartmentNames =
    [
      identity?.department?.name,
      ...(identity?.managedDepartments ?? []).map(
        (department) => department.name,
      ),
    ]
      .filter(
        (name): name is string =>
          Boolean(name),
      )
      .map((name) =>
        name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ''),
      );

  const isClientServicing =
    normalizedDepartmentNames.some(
      (name) =>
        [
          'clientservicing',
          'clientservice',
          'clientservicingdepartment',
          'clientrelations',
          'clientrelationship',
        ].includes(name),
    );

  const request = async <T,>(
    path: string,
    init?: RequestInit,
  ): Promise<T> => {
    const response =
      await authFetch(path, init);

    const body =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        body?.message ??
          'Request failed.',
      );
    }

    return body as T;
  };

  const loadOperationalSettings =
    async () => {
      try {
        const me =
          await request<SettingsIdentity>(
            '/employees/me',
          );

        setIdentity(me);
      } catch {
        setIdentity(null);
      }
    };

  const loadClients =
    async () => {
      if (!isClientServicing) {
        return;
      }

      const result =
        await request<{
          data: ClientOption[];
        }>(
          '/clients?limit=100&isActive=true&sortBy=name&sortOrder=asc',
        );

      setClients(result.data ?? []);
    };

  const loadSuperAdmins =
    async () => {
      if (!isSuperAdmin) {
        return;
      }

      const result =
        await request<SuperAdminRecord[]>(
          '/employees/super-admins',
        );

      setSuperAdmins(result);
    };

  const loadTeamMembers =
    async () => {
      if (!isSuperAdmin) {
        return;
      }

      const result =
        await request<TeamMemberRecord[]>(
          '/employees?employmentStatus=ACTIVE',
        );

      setTeamMembers(
        result.filter(
          (member) =>
            !member.user.roles.some(
              (item) =>
                item.role.name ===
                'SUPER_ADMIN',
            ),
        ),
      );
    };

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      30_000,
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadOperationalSettings();
  }, [user?.id]);

  useEffect(() => {
    if (isClientServicing) {
      void loadClients();
    }
  }, [isClientServicing]);

  useEffect(() => {
    if (isSuperAdmin) {
      void loadSuperAdmins();
      void loadTeamMembers();
    }
  }, [isSuperAdmin]);

  const closeClient =
    async () => {
      if (!closingClientId) {
        await appDialog.alert({
          title: 'Select client',
          message:
            'Choose the client you want to close.',
        });
        return;
      }

      const client =
        clients.find(
          (item) =>
            item.id ===
            closingClientId,
        );

      const confirmed =
        await appDialog.confirm({
          title: 'Close client?',
          message:
            `This will close ${client?.companyName ?? client?.name ?? 'this client'} and stop all open projects, tasks and recurring work. History will remain available.`,
          confirmLabel: 'Close Client',
          cancelLabel: 'Cancel',
          tone: 'danger',
        });

      if (!confirmed) {
        return;
      }

      try {
        await request(
          `/clients/${closingClientId}/close`,
          {
            method: 'POST',
          },
        );

        setClosingClientId('');
        await loadClients();

        await appDialog.alert({
          title: 'Client closed',
          message:
            'The client and all open work have been closed.',
        });
      } catch (error) {
        await appDialog.alert({
          title: 'Unable to close client',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to close client.',
        });
      }
    };

  const removeTeamMember =
    async () => {
      if (!removingMemberId) {
        await appDialog.alert({
          title: 'Select team member',
          message:
            'Choose the existing team member you want to remove.',
        });
        return;
      }

      const member =
        teamMembers.find(
          (item) =>
            item.id === removingMemberId,
        );

      const confirmed =
        await appDialog.confirm({
          title: 'Remove team member?',
          message:
            `Remove ${member?.fullName ?? 'this team member'} from Unicolors Workspace? Their login will be disabled and completed work/history will remain preserved. Active tasks or projects must be reassigned first.`,
          confirmLabel: 'Remove Member',
          cancelLabel: 'Cancel',
          tone: 'danger',
        });

      if (!confirmed) {
        return;
      }

      setRemoveMemberBusy(true);

      try {
        await request(
          `/employees/${removingMemberId}`,
          {
            method: 'DELETE',
          },
        );

        setRemovingMemberId('');
        await loadTeamMembers();

        await appDialog.alert({
          title: 'Team member removed',
          message:
            'Workspace login has been disabled. Completed work and historical records are preserved.',
        });
      } catch (error) {
        await appDialog.alert({
          title: 'Unable to remove team member',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to remove team member.',
        });
      } finally {
        setRemoveMemberBusy(false);
      }
    };

  const createSuperAdmin =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      const form =
        new FormData(
          event.currentTarget,
        );

      setAccountBusy(true);

      try {
        await request(
          '/employees/super-admins',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              fullName:
                String(
                  form.get('fullName') ??
                    '',
                ).trim(),
              username:
                String(
                  form.get('username') ??
                    '',
                ).trim(),
              email:
                String(
                  form.get('email') ??
                    '',
                ).trim() || undefined,
              phone:
                String(
                  form.get('phone') ??
                    '',
                ).trim() || undefined,
              temporaryPassword:
                String(
                  form.get(
                    'temporaryPassword',
                  ) ?? '',
                ),
            }),
          },
        );

        setShowAddSuperAdmin(false);
        await loadSuperAdmins();

        await appDialog.alert({
          title: 'Super Admin created',
          message:
            'The new Super Admin can sign in with the credentials you provided.',
        });
      } catch (error) {
        await appDialog.alert({
          title: 'Unable to create Super Admin',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to create Super Admin.',
        });
      } finally {
        setAccountBusy(false);
      }
    };

  const saveSuperAdminLogin =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (!manageSuperAdmin) {
        return;
      }

      const form =
        new FormData(
          event.currentTarget,
        );

      setAccountBusy(true);

      try {
        const temporaryPassword =
          String(
            form.get(
              'temporaryPassword',
            ) ?? '',
          );

        await request(
          `/employees/${manageSuperAdmin.id}/login`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              username:
                String(
                  form.get('username') ??
                    '',
                ).trim() || undefined,
              email:
                String(
                  form.get('email') ??
                    '',
                ).trim() || undefined,
              phone:
                String(
                  form.get('phone') ??
                    '',
                ).trim() || undefined,
              ...(temporaryPassword
                ? {
                    temporaryPassword,
                  }
                : {}),
              isActive:
                form.get('isActive') ===
                'on',
            }),
          },
        );

        setManageSuperAdmin(null);
        await loadSuperAdmins();

        await appDialog.alert({
          title: 'Login updated',
          message:
            'Super Admin login details have been saved.',
        });
      } catch (error) {
        await appDialog.alert({
          title: 'Unable to update login',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to update login.',
        });
      } finally {
        setAccountBusy(false);
      }
    };

  useEffect(() => {
    setSaved(true);
    const timer = window.setTimeout(
      () => setSaved(false),
      1_200,
    );

    return () =>
      window.clearTimeout(timer);
  }, [preferences]);

  const preview = useMemo(
    () =>
      formatWorkspaceDateTime(
        now,
        preferences,
      ),
    [now, preferences],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {text.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
          {saved && (
            <>
              <Check className="h-4 w-4" />
              {text.saved}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {text.display}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {text.displayHelp}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="text-sm font-semibold text-slate-700">
              {text.theme}
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active =
                  preferences.theme ===
                  option.value;
                const label =
                  option.value === 'system'
                    ? text.system
                    : option.value === 'light'
                      ? text.light
                      : text.dark;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updatePreferences({
                        theme: option.value,
                      })
                    }
                    className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-semibold transition ${
                      active
                        ? 'border-violet-500 bg-violet-50 text-violet-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <ToggleRow
            className="mt-6"
            checked={preferences.reducedMotion}
            onChange={(checked) =>
              updatePreferences({
                reducedMotion: checked,
              })
            }
            label={text.reducedMotion}
            description={
              text.reducedMotionHelp
            }
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {text.language}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {text.languageHelp}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label
              htmlFor="workspace-language"
              className="text-sm font-semibold text-slate-700"
            >
              {text.language}
            </label>
            <select
              id="workspace-language"
              value={preferences.language}
              onChange={(event) =>
                updatePreferences({
                  language:
                    event.target.value as LanguagePreference,
                })
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            >
              {languages.map((language) => (
                <option
                  key={language.value}
                  value={language.value}
                >
                  {language.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            {text.instant}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {text.dateTime}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {text.dateTimeHelp}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <SelectField
            label={text.dateFormat}
            value={preferences.dateFormat}
            onChange={(value) =>
              updatePreferences({
                dateFormat:
                  value as DateFormatPreference,
              })
            }
          >
            {dateFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={text.timeFormat}
            value={preferences.timeFormat}
            onChange={(value) =>
              updatePreferences({
                timeFormat:
                  value as TimeFormatPreference,
              })
            }
          >
            <option value="12h">12-hour</option>
            <option value="24h">24-hour</option>
          </SelectField>

          <SelectField
            label={text.timeZone}
            value={preferences.timeZone}
            onChange={(value) =>
              updatePreferences({
                timeZone:
                  value as TimeZonePreference,
              })
            }
          >
            {timeZones.map((zone) => (
              <option
                key={zone.value}
                value={zone.value}
              >
                {zone.label}
              </option>
            ))}
          </SelectField>
        </div>

        <ToggleRow
          className="mt-6"
          checked={
            preferences.showHeaderDateTime
          }
          onChange={(checked) =>
            updatePreferences({
              showHeaderDateTime: checked,
            })
          }
          label={text.showHeaderDateTime}
        />

        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {text.preview}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            {preview}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {preferences.timeZone}
          </p>
        </div>
      </section>

      {isClientServicing && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Client Settings
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Close a client when the engagement has ended.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <select
              value={closingClientId}
              onChange={(event) =>
                setClosingClientId(
                  event.target.value,
                )
              }
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">
                Select active client
              </option>
              {clients.map((client) => (
                <option
                  key={client.id}
                  value={client.id}
                >
                  {client.companyName ??
                    client.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                void closeClient()
              }
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
            >
              Close Client
            </button>
          </div>
        </section>
      )}

      {isSuperAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-50 p-2.5 text-red-700">
              <UserMinus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Team Member Management
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Remove an existing member when they leave the company. Historical work remains preserved.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <select
              value={removingMemberId}
              onChange={(event) =>
                setRemovingMemberId(
                  event.target.value,
                )
              }
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">
                Select existing team member
              </option>
              {teamMembers.map((member) => (
                <option
                  key={member.id}
                  value={member.id}
                >
                  {member.fullName}
                  {member.designation
                    ? ` · ${member.designation}`
                    : ''}
                  {member.department?.name
                    ? ` · ${member.department.name}`
                    : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={removeMemberBusy}
              onClick={() =>
                void removeTeamMember()
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserMinus className="h-4 w-4" />
              {removeMemberBusy
                ? 'Removing…'
                : 'Remove Member'}
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            If the member still has active tasks or active projects, removal will be blocked until that work is reassigned.
          </p>
        </section>
      )}

      {isSuperAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Super Admin Accounts
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep a separate login for every Super Admin.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowAddSuperAdmin(true)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Add Super Admin
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            {superAdmins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {admin.fullName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    @{admin.username ?? 'username'} · {admin.user.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setManageSuperAdmin(
                      admin,
                    )
                  }
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Manage Login
                </button>
              </div>
            ))}

            {!superAdmins.length && (
              <p className="px-4 py-5 text-sm text-slate-500">
                No Super Admin accounts found.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={resetPreferences}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          {text.reset}
        </button>
      </div>

      {showAddSuperAdmin && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={createSuperAdmin}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-950">
                Add Super Admin
              </h3>
              <button
                type="button"
                onClick={() =>
                  setShowAddSuperAdmin(
                    false,
                  )
                }
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                name="fullName"
                required
                placeholder="Full name"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="username"
                required
                placeholder="Username"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="phone"
                placeholder="Phone"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="temporaryPassword"
                type="password"
                required
                minLength={8}
                placeholder="Temporary password"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm sm:col-span-2"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowAddSuperAdmin(
                    false,
                  )
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={accountBusy}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {accountBusy
                  ? 'Creating…'
                  : 'Create Login'}
              </button>
            </div>
          </form>
        </div>
      )}

      {manageSuperAdmin && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/40 p-4">
          <form
            onSubmit={saveSuperAdminLogin}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Manage Login
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {manageSuperAdmin.fullName}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setManageSuperAdmin(null)
                }
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                name="username"
                defaultValue={
                  manageSuperAdmin.username ??
                  ''
                }
                placeholder="Username"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="email"
                type="email"
                defaultValue={
                  manageSuperAdmin.user.email ??
                  ''
                }
                placeholder="Email"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="phone"
                defaultValue={
                  manageSuperAdmin.user.phone ??
                  ''
                }
                placeholder="Phone"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                name="temporaryPassword"
                type="password"
                minLength={8}
                placeholder="New password (optional)"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={
                  manageSuperAdmin.user.isActive
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Login active
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setManageSuperAdmin(null)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={accountBusy}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {accountBusy
                  ? 'Saving…'
                  : 'Save Login'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
      >
        {children}
      </select>
    </label>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  description,
  className = '',
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 ${className}`}
    >
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {label}
        </p>
        {description && (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked
            ? 'bg-violet-600'
            : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
