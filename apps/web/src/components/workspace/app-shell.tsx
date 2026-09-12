'use client';

import Link from 'next/link';
import {
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import type {
  ComponentType,
  ReactNode,
} from 'react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  BriefcaseBusiness,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  ChartNoAxesCombined,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

import {
  useAuth,
} from '@/components/auth/auth-provider';

import {
  NotificationBell,
} from './notification-bell';

import styles from './app-shell-theme.module.css';
import {
  formatWorkspaceDateTime,
  getResolvedTheme,
  getWorkspaceTimeZoneLabel,
  useWorkspacePreferences,
} from './workspace-preferences';

type NavigationLabelKey =
  | 'dashboard'
  | 'overview'
  | 'tasks'
  | 'myTasks'
  | 'kanban'
  | 'projects'
  | 'clients'
  | 'team'
  | 'departments'
  | 'calendar'
  | 'timeTracking'
  | 'reports'
  | 'notifications'
  | 'activityLogs'
  | 'settings'
  | 'addEmployee';

const shellCopy = {
  en: {
    internalWorkspace: 'Internal Workspace',
    workspace: 'Unicolors Workspace',
    signOut: 'Sign out',
    dashboard: 'Dashboard',
    overview: 'Overview',
    tasks: 'Tasks',
    myTasks: 'My Tasks',
    kanban: 'Kanban',
    projects: 'Projects',
    clients: 'Clients',
    team: 'Team',
    teamMembers: 'Team Members',
    departments: 'Departments',
    calendar: 'Calendar',
    timeTracking: 'Time Tracking',
    reports: 'Reports',
    notifications: 'Notifications',
    activityLogs: 'Activity Logs',
    settings: 'Settings',
    addEmployee: 'Add Employee',
  },
  hi: {
    internalWorkspace: 'आंतरिक वर्कस्पेस',
    workspace: 'Unicolors Workspace',
    signOut: 'साइन आउट',
    dashboard: 'डैशबोर्ड',
    overview: 'ओवरव्यू',
    tasks: 'टास्क',
    myTasks: 'मेरे टास्क',
    kanban: 'कानबन',
    projects: 'प्रोजेक्ट्स',
    clients: 'क्लाइंट्स',
    team: 'टीम',
    teamMembers: 'टीम मेंबर्स',
    departments: 'डिपार्टमेंट्स',
    calendar: 'कैलेंडर',
    timeTracking: 'टाइम ट्रैकिंग',
    reports: 'रिपोर्ट्स',
    notifications: 'नोटिफिकेशन',
    activityLogs: 'एक्टिविटी लॉग्स',
    settings: 'सेटिंग्स',
    addEmployee: 'Add Employee',
  },
  gu: {
    internalWorkspace: 'આંતરિક વર્કસ્પેસ',
    workspace: 'Unicolors Workspace',
    signOut: 'સાઇન આઉટ',
    dashboard: 'ડેશબોર્ડ',
    overview: 'ઓવરવ્યૂ',
    tasks: 'ટાસ્ક',
    myTasks: 'મારા ટાસ્ક',
    kanban: 'કાનબન',
    projects: 'પ્રોજેક્ટ્સ',
    clients: 'ક્લાયન્ટ્સ',
    team: 'ટીમ',
    teamMembers: 'ટીમ મેમ્બર્સ',
    departments: 'વિભાગો',
    calendar: 'કેલેન્ડર',
    timeTracking: 'ટાઇમ ટ્રેકિંગ',
    reports: 'રિપોર્ટ્સ',
    notifications: 'નોટિફિકેશન',
    activityLogs: 'એક્ટિવિટી લોગ્સ',
    settings: 'સેટિંગ્સ',
    addEmployee: 'Add Employee',
  },
} as const;

type NavigationItem = {
  labelKey: NavigationLabelKey;
  href: string;
  icon: ComponentType<{
    className?: string;
  }>;
  permission?: string;
};

type WorkspaceIdentity = {
  fullName: string;
  designation: string | null;
  department?: {
    id: string;
    name: string;
  } | null;
  managedDepartments?: Array<{
    id: string;
    name: string;
  }>;
};

const navigation: NavigationItem[] = [
  {
    labelKey: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'tasks',
    href: '/tasks',
    icon: ListTodo,
  },
  {
    labelKey: 'kanban',
    href: '/kanban',
    icon: Columns3,
    permission: 'tasks.view',
  },
  {
    labelKey: 'projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    labelKey: 'clients',
    href: '/clients',
    icon: BriefcaseBusiness,
  },
  {
    labelKey: 'team',
    href: '/team',
    icon: Users,
  },
  {
    labelKey: 'departments',
    href: '/departments',
    icon: Building2,
    permission: 'departments.view',
  },
  {
    labelKey: 'calendar',
    href: '/calendar',
    icon: CalendarDays,
  },
  {
    labelKey: 'timeTracking',
    href: '/time-tracking',
    icon: Clock3,
    permission: 'time.manage_own',
  },
  {
    labelKey: 'reports',
    href: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    labelKey: 'activityLogs',
    href: '/activity-logs',
    icon: ShieldCheck,
  },
  {
    labelKey: 'notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
];

const superAdminNavigation: NavigationItem[] = [
  {
    labelKey: 'kanban',
    href: '/kanban',
    icon: Columns3,
    permission: 'tasks.view',
  },
  {
    labelKey: 'tasks',
    href: '/tasks',
    icon: ListTodo,
  },
  {
    labelKey: 'projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    labelKey: 'clients',
    href: '/clients',
    icon: BriefcaseBusiness,
  },
  {
    labelKey: 'team',
    href: '/team',
    icon: Users,
  },
  {
    labelKey: 'dashboard',
    href: '/super-admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'departments',
    href: '/departments',
    icon: Building2,
    permission: 'departments.view',
  },
  {
    labelKey: 'calendar',
    href: '/calendar',
    icon: CalendarDays,
  },
  {
    labelKey: 'timeTracking',
    href: '/time-tracking',
    icon: Clock3,
    permission: 'time.manage_own',
  },
  {
    labelKey: 'reports',
    href: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    labelKey: 'activityLogs',
    href: '/activity-logs',
    icon: ShieldCheck,
  },
  {
    labelKey: 'notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
];

const myTasksNavigationItem: NavigationItem = {
  labelKey: 'myTasks',
  href: '/tasks?mine=1',
  icon: ListTodo,
  permission: 'tasks.view',
};

const teamMemberNavigation: NavigationItem[] = [
  {
    labelKey: 'kanban',
    href: '/kanban',
    icon: Columns3,
    permission: 'tasks.view',
  },
  myTasksNavigationItem,
  {
    labelKey: 'projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    labelKey: 'team',
    href: '/team',
    icon: Users,
  },
  {
    labelKey: 'calendar',
    href: '/calendar',
    icon: CalendarDays,
  },
  {
    labelKey: 'timeTracking',
    href: '/time-tracking',
    icon: Clock3,
    permission: 'time.manage_own',
  },
  {
    labelKey: 'reports',
    href: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    labelKey: 'notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
];

const hrNavigation: NavigationItem[] = [
  {
    labelKey: 'dashboard',
    href: '/manager/dashboard',
    icon: LayoutDashboard,
  },
  {
    labelKey: 'addEmployee',
    href: '/manager/employees/new',
    icon: UserPlus,
  },
];

const bdmNavigation: NavigationItem[] = [
  {
    labelKey: 'dashboard',
    href: '/manager/dashboard',
    icon: LayoutDashboard,
  },
  myTasksNavigationItem,
  {
    labelKey: 'clients',
    href: '/clients',
    icon: BriefcaseBusiness,
  },
];

const clientServicingNavigation: NavigationItem[] = [
  {
    labelKey: 'dashboard',
    href: '/manager/dashboard',
    icon: LayoutDashboard,
  },
  myTasksNavigationItem,
  {
    labelKey: 'projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    labelKey: 'tasks',
    href: '/tasks',
    icon: ListTodo,
  },
  {
    labelKey: 'kanban',
    href: '/kanban',
    icon: Columns3,
  },
  {
    labelKey: 'clients',
    href: '/clients',
    icon: BriefcaseBusiness,
  },
  {
    labelKey: 'team',
    href: '/team',
    icon: Users,
  },
  {
    labelKey: 'calendar',
    href: '/calendar',
    icon: CalendarDays,
  },
  {
    labelKey: 'notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    labelKey: 'reports',
    href: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    labelKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
];

export function AppShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname =
    usePathname();

  const searchParams =
    useSearchParams();

  const router =
    useRouter();

  const {
    user,
    logout,
    authFetch,
    hasPermission,
  } = useAuth();


  const {
    preferences,
  } = useWorkspacePreferences();

  const [now, setNow] =
    useState(() => new Date());

  const [systemDark, setSystemDark] =
    useState(false);

  const [identity, setIdentity] =
    useState<WorkspaceIdentity | null>(null);

  const [identityLoaded, setIdentityLoaded] =
    useState(false);

  const [sidebarExpanded, setSidebarExpanded] =
    useState(true);

  const [toastMessage, setToastMessage] =
    useState('');

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      30_000,
    );

    return () =>
      window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-color-scheme: dark)',
    );

    const sync = () =>
      setSystemDark(media.matches);

    sync();
    media.addEventListener('change', sync);

    return () =>
      media.removeEventListener(
        'change',
        sync,
      );
  }, []);

  useEffect(() => {
    let active = true;

    const loadIdentity = async () => {
      if (active) {
        setIdentityLoaded(false);
      }

      try {
        const response = await authFetch(
          '/employees/me',
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as WorkspaceIdentity;

        if (active) {
          setIdentity(data);
        }
      } catch {
        // Greeting falls back to the signed-in account label.
      } finally {
        if (active) {
          setIdentityLoaded(true);
        }
      }
    };

    void loadIdentity();

    return () => {
      active = false;
    };
  }, [authFetch, user?.id]);

  useEffect(() => {
    const nativeAlert = window.alert;

    window.alert = (message?: unknown) => {
      setToastMessage(String(message ?? ''));
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timer = window.setTimeout(
      () => setToastMessage(''),
      3200,
    );

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const resolvedTheme = useMemo(() => {
    if (preferences.theme === 'system') {
      return systemDark ? 'dark' : 'light';
    }

    return getResolvedTheme(
      preferences.theme,
    );
  }, [preferences.theme, systemDark]);

  const text =
    shellCopy[preferences.language];

  const headerDateTime = useMemo(
    () =>
      formatWorkspaceDateTime(
        now,
        preferences,
      ),
    [now, preferences],
  );

  const isSuperAdmin =
    Boolean(
      user?.roles?.includes('SUPER_ADMIN'),
    );

  const isAdmin =
    Boolean(
      user?.roles?.includes('ADMIN') &&
        !user?.roles?.includes('SUPER_ADMIN'),
    );

  const isManager =
    Boolean(
      user?.roles?.includes('MANAGER') &&
        !user?.roles?.includes('ADMIN') &&
        !user?.roles?.includes('SUPER_ADMIN'),
    );

  const isTeamMember =
    Boolean(
      user?.roles?.includes('EMPLOYEE') &&
        !user?.roles?.includes('MANAGER') &&
        !user?.roles?.includes('ADMIN') &&
        !user?.roles?.includes('SUPER_ADMIN'),
    );

  const normalizedDepartmentName =
    (identity?.department?.name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const managedDepartmentNames =
    (identity?.managedDepartments ?? [])
      .map((department) =>
        department.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ''),
      )
      .filter(Boolean);

  const allDepartmentNames = Array.from(
    new Set([
      ...(normalizedDepartmentName
        ? [normalizedDepartmentName]
        : []),
      ...managedDepartmentNames,
    ]),
  );

  const isHrManager =
    isManager &&
    allDepartmentNames.some(
      (name) =>
        name === 'hr' ||
        name === 'humanresources',
    );

  const isHrOnlyManager =
    isHrManager &&
    allDepartmentNames.every(
      (name) =>
        name === 'hr' ||
        name === 'humanresources',
    );

  const bdmDepartmentNames = [
    'businessdevelopment',
    'businessdevelopmentmanager',
    'businessdevelopmentdepartment',
    'bdm',
    'bd',
  ];

  const isBusinessDevelopment =
    allDepartmentNames.some((name) =>
      bdmDepartmentNames.includes(name),
    );

  const isBdmManager =
    isManager && isBusinessDevelopment;

  const isBdmOnlyManager =
    isBdmManager &&
    allDepartmentNames.every((name) =>
      bdmDepartmentNames.includes(name),
    );


  const accountsDepartmentNames = [
    'accounts',
    'account',
    'accountsquotation',
    'accountsandquotation',
    'accountsfinance',
    'accountsandfinance',
    'finance',
  ];

  const isAccountsManager =
    isManager &&
    allDepartmentNames.some((name) =>
      accountsDepartmentNames.includes(name),
    );

  const clientServicingDepartmentNames = [
    'clientservicing',
    'clientservice',
    'clientservicingdepartment',
    'clientrelations',
    'clientrelationship',
  ];

  const isClientServicingManager =
    isManager &&
    allDepartmentNames.some((name) =>
      clientServicingDepartmentNames.includes(name),
    );

  const isClientServicingOnlyManager =
    isClientServicingManager &&
    allDepartmentNames.every((name) =>
      clientServicingDepartmentNames.includes(name),
    );

  useEffect(() => {
    if (
      !isSuperAdmin &&
      (pathname === '/activity-logs' ||
        pathname.startsWith('/activity-logs/'))
    ) {
      router.replace(isTeamMember ? '/kanban' : '/tasks');
      return;
    }

    if (
      !isSuperAdmin &&
      (pathname === '/departments' ||
        pathname.startsWith('/departments/'))
    ) {
      router.replace(isManager ? '/manager/dashboard' : isTeamMember ? '/kanban' : '/tasks');
      return;
    }

    if (
      isTeamMember &&
      !isBusinessDevelopment &&
      (pathname === '/clients' ||
        pathname.startsWith('/clients/'))
    ) {
      router.replace('/kanban');
      return;
    }

    const isDashboardRoute =
      pathname === '/dashboard' ||
      pathname === '/admin/dashboard' ||
      pathname === '/manager/dashboard' ||
      pathname === '/employee/dashboard';

    if (isManager && !identityLoaded) {
      return;
    }

    if (isHrOnlyManager) {
      const isAllowedHrRoute =
        pathname === '/manager/dashboard' ||
        pathname === '/manager/employees/new';

      if (!isAllowedHrRoute) {
        router.replace('/manager/dashboard');
      }

      return;
    }

    if (isBdmOnlyManager) {
      const isAllowedBdmRoute =
        pathname === '/manager/dashboard' ||
        pathname === '/clients' ||
        pathname.startsWith('/clients/') ||
        pathname === '/tasks' ||
        pathname.startsWith('/tasks/');

      if (!isAllowedBdmRoute) {
        router.replace('/manager/dashboard');
      }

      return;
    }

    if (isClientServicingOnlyManager) {
      const isAllowedClientServicingRoute =
        pathname === '/manager/dashboard' ||
        pathname === '/projects' ||
        pathname.startsWith('/projects/') ||
        pathname === '/tasks' ||
        pathname.startsWith('/tasks/') ||
        pathname === '/kanban' ||
        pathname.startsWith('/kanban/') ||
        pathname === '/clients' ||
        pathname.startsWith('/clients/') ||
        pathname === '/team' ||
        pathname.startsWith('/team/') ||
        pathname === '/calendar' ||
        pathname.startsWith('/calendar/') ||
        pathname === '/notifications' ||
        pathname.startsWith('/notifications/') ||
        pathname === '/reports' ||
        pathname.startsWith('/reports/') ||
        pathname === '/settings' ||
        pathname.startsWith('/settings/');

      if (!isAllowedClientServicingRoute) {
        router.replace('/manager/dashboard');
      }

      return;
    }

    if (
      isManager &&
      (isHrManager || isBdmManager || isAccountsManager || isClientServicingManager) &&
      isDashboardRoute
    ) {
      if (pathname !== '/manager/dashboard') {
        router.replace('/manager/dashboard');
      }

      return;
    }

    if (isManager && isDashboardRoute) {
      router.replace('/tasks');
      return;
    }

    if (
      isTeamMember &&
      isDashboardRoute
    ) {
      router.replace('/kanban');
      return;
    }

    if (
      isAdmin &&
      isDashboardRoute
    ) {
      router.replace('/tasks');
    }
  }, [
    isSuperAdmin,
    isAdmin,
    isManager,
    isTeamMember,
    isHrManager,
    isHrOnlyManager,
    isBusinessDevelopment,
    isBdmManager,
    isBdmOnlyManager,
    isAccountsManager,
    isClientServicingManager,
    isClientServicingOnlyManager,
    identityLoaded,
    pathname,
    router,
  ]);

  const baseVisibleNavigation = navigation.filter(
    (item) =>
      (item.labelKey !== 'dashboard' ||
        isSuperAdmin) &&
      (!isTeamMember ||
        isBusinessDevelopment ||
        item.labelKey !== 'clients') &&
      (item.labelKey !== 'activityLogs' ||
        isSuperAdmin) &&
      (item.labelKey !== 'departments' ||
        isSuperAdmin) &&
      (!item.permission ||
        hasPermission(
          item.permission,
        )),
  );

  const visibleNavigation = isSuperAdmin
    ? superAdminNavigation.filter(
        (item) =>
          !item.permission ||
          hasPermission(item.permission),
      )
    : isHrOnlyManager
      ? hrNavigation
      : isTeamMember
      ? teamMemberNavigation.filter(
          (item) =>
            !item.permission ||
            hasPermission(item.permission),
        )
      : isBdmOnlyManager
        ? bdmNavigation
        : isClientServicingOnlyManager
          ? clientServicingNavigation
          : [
            ...(
              (isHrManager || isBdmManager || isAccountsManager || isClientServicingManager) &&
              !isSuperAdmin
                ? [bdmNavigation[0]]
                : []
            ),
            ...(
              isManager && !isHrOnlyManager
                ? [myTasksNavigationItem]
                : []
            ),
            ...baseVisibleNavigation,
            ...(isHrManager
              ? [hrNavigation[1]]
              : []),
          ];

  const roleLabel =
    isTeamMember
      ? 'Team Member'
      : user?.roles?.[0]?.replaceAll('_', ' ') ??
        'User';

  const displayName =
    identity?.fullName?.trim() ||
    user?.email?.split('@')[0] ||
    user?.phone ||
    'User';

  const departmentDisplayNames = Array.from(
    new Set(
      (isManager
        ? [
            ...(identity?.managedDepartments ?? []).map(
              (department) => department.name.trim(),
            ),
            identity?.department?.name?.trim() ?? '',
          ]
        : [identity?.department?.name?.trim() ?? '']
      ).filter(Boolean),
    ),
  );

  const departmentDisplay =
    departmentDisplayNames.join(' · ');

  const displayDesignation = isManager
    ? `Head of the Department${
        departmentDisplay ? ` (${departmentDisplay})` : ''
      }`
    : isTeamMember
      ? `Team Member${
          departmentDisplay ? ` (${departmentDisplay})` : ''
        }`
      : identity?.designation?.trim() || roleLabel;

  const toggleSidebar = () => {
    setSidebarExpanded((current) => !current);
  };

  const handleLogout =
    async () => {
      await logout();

      router.replace('/login');
    };

  return (
    <div
      className={`flex min-h-screen bg-[#F6F3ED] text-[#313851] ${styles.themeRoot} ${
        resolvedTheme === 'dark'
          ? styles.darkTheme
          : ''
      } ${
        preferences.reducedMotion
          ? styles.reducedMotion
          : ''
      }`}
    >
      <aside
        className={`${styles.sidebar} relative hidden shrink-0 flex-col border-r border-[#C2CBD3]/30 bg-[#313851] lg:flex ${
          sidebarExpanded ? 'w-60' : 'w-[76px]'
        }`}
      >
        <div
          className={`border-b border-white/10 py-4 ${
            sidebarExpanded ? 'px-4' : 'px-2'
          }`}
        >
          <div
            className={`flex ${
              sidebarExpanded
                ? 'items-center justify-between gap-3'
                : 'flex-col items-center gap-3'
            }`}
          >
            <div
              className={`flex min-w-0 items-center ${
                sidebarExpanded ? 'gap-2.5' : 'justify-center'
              }`}
            >
              <img
                src="/unicolors-mark.png"
                alt="Unicolors"
                className="h-9 w-9 shrink-0 object-contain"
              />
              {sidebarExpanded && (
                <div className={`${styles.sidebarLabel} min-w-0`}>
                  <div className="truncate text-xl font-black tracking-tight text-white">
                    UNICOLORS
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium tracking-wide text-[#C2CBD3]/75">
                    Task Management
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSidebar}
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={sidebarExpanded}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 p-2.5 text-[#C2CBD3] shadow-sm hover:bg-white/15 hover:text-white"
            >
              {sidebarExpanded ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <nav
          className={`flex-1 space-y-1 overflow-y-auto py-3 ${
            sidebarExpanded ? 'px-3' : 'px-2'
          }`}
        >
          {visibleNavigation.map(
            (item) => {
              const Icon =
                item.icon;

              const itemHref =
                (isHrManager || isBdmManager || isAccountsManager || isClientServicingManager) &&
                item.labelKey === 'dashboard'
                  ? '/manager/dashboard'
                  : item.href;

              const isMyTasksMode =
                searchParams.get('mine') === '1';

              const itemPath =
                itemHref.split('?')[0];

              const active =
                item.labelKey === 'myTasks'
                  ? pathname === '/tasks' &&
                    isMyTasksMode
                  : item.labelKey === 'tasks'
                    ? pathname === '/tasks' &&
                      !isMyTasksMode
                    : pathname === itemPath ||
                      pathname.startsWith(
                        `${itemPath}/`,
                      );

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    itemHref
                  }
                  title={
                    sidebarExpanded
                      ? undefined
                      : isBusinessDevelopment && item.labelKey === 'clients'
                        ? 'Client Onboarding'
                        : isTeamMember && item.labelKey === 'tasks'
                          ? text.myTasks
                          : isManager && item.labelKey === 'team'
                            ? text.teamMembers
                            : text[item.labelKey]
                  }
                  className={`${styles.navItem} flex items-center rounded-xl py-2.5 text-sm font-medium ${
                    sidebarExpanded ? 'gap-3 px-3' : 'justify-center px-2'
                  } ${
                    active
                      ? 'bg-[#F6F3ED] text-[#313851] shadow-sm'
                      : 'text-[#C2CBD3] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />

                  {sidebarExpanded && (
                    <span className={`${styles.sidebarLabel} flex-1`}>
                      {isBusinessDevelopment &&
                      item.labelKey === 'clients'
                        ? 'Client Onboarding'
                        : isTeamMember &&
                            item.labelKey === 'tasks'
                          ? text.myTasks
                          : isManager &&
                              item.labelKey === 'team'
                            ? text.teamMembers
                            : text[item.labelKey]}
                    </span>
                  )}

                  {active && sidebarExpanded && (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Link>
              );
            },
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div
            title={sidebarExpanded ? undefined : `${displayName} · ${displayDesignation}`}
            className={`mb-2 flex items-center rounded-xl bg-white/5 p-3 ${
              sidebarExpanded ? 'gap-3' : 'justify-center'
            }`}
          >
            <CircleUserRound className="h-8 w-8 shrink-0 text-[#C2CBD3]" />

            {sidebarExpanded && (
              <div className={`${styles.sidebarLabel} min-w-0`}>
                <p className="truncate text-sm font-semibold text-white">
                  {displayName}
                </p>

                <p className="truncate text-xs text-[#C2CBD3]/70">
                  {displayDesignation}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            title={text.signOut}
            onClick={() =>
              void handleLogout()
            }
            className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-[#C2CBD3] hover:bg-white/10 hover:text-white ${
              sidebarExpanded ? 'gap-3 px-3' : 'justify-center px-2'
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />

            {sidebarExpanded && (
              <span className={styles.sidebarLabel}>
                {text.signOut}
              </span>
            )}
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 bg-transparent">
          <div className="flex h-14 items-center justify-end px-4 md:px-6">
            <div className="flex items-center gap-2">
              {preferences.showHeaderDateTime && (
                <div className="hidden text-right md:block">
                  <p className="text-xs font-semibold text-[#313851]">
                    {headerDateTime}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#313851]/55">
                    {getWorkspaceTimeZoneLabel(
                      preferences.timeZone,
                    )}
                  </p>
                </div>
              )}

              <NotificationBell />

              <button
                type="button"
                onClick={() =>
                  void handleLogout()
                }
                className="rounded-xl border border-[#C2CBD3] bg-white/55 p-2.5 text-[#313851] transition hover:bg-white lg:hidden"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 pb-2 lg:hidden">
            {visibleNavigation.map(
              (item) => {
                const Icon =
                  item.icon;

                const itemHref =
                  (isHrManager || isBdmManager || isAccountsManager || isClientServicingManager) &&
                  item.labelKey === 'dashboard'
                    ? '/manager/dashboard'
                    : item.href;

                const isMyTasksMode =
                  searchParams.get('mine') === '1';

                const itemPath =
                  itemHref.split('?')[0];

                const active =
                  item.labelKey === 'myTasks'
                    ? pathname === '/tasks' &&
                      isMyTasksMode
                    : item.labelKey === 'tasks'
                      ? pathname === '/tasks' &&
                        !isMyTasksMode
                      : pathname === itemPath ||
                        pathname.startsWith(
                          `${itemPath}/`,
                        );

                return (
                  <Link
                    key={
                      item.href
                    }
                    href={
                      itemHref
                    }
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-[#313851] text-white'
                        : 'bg-[#C2CBD3]/45 text-[#313851]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {isBusinessDevelopment &&
                    item.labelKey === 'clients'
                      ? 'Client Onboarding'
                      : isTeamMember &&
                          item.labelKey === 'tasks'
                        ? text.myTasks
                        : isManager &&
                            item.labelKey === 'team'
                          ? text.teamMembers
                          : text[item.labelKey]}
                  </Link>
                );
              },
            )}
          </div>
        </header>

        <main className="px-4 pb-6 pt-2 md:px-6 md:pb-8 md:pt-3">
          <div key={pathname} className={styles.pageEnter}>
            <div className="mb-3">
              <p className="text-2xl font-black tracking-tight text-[#313851]">
                Hello, {displayName}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[#313851]/65">
                {displayDesignation}
              </p>
            </div>

            {children}
          </div>
        </main>
      </div>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-20 z-[120] max-w-sm rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
