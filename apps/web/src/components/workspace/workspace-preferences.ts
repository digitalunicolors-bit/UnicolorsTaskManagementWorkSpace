'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

export type ThemePreference =
  | 'system'
  | 'light'
  | 'dark';

export type LanguagePreference =
  | 'en'
  | 'hi'
  | 'gu';

export type DateFormatPreference =
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY-MM-DD';

export type TimeFormatPreference =
  | '12h'
  | '24h';

export type TimeZonePreference =
  | 'Asia/Kolkata'
  | 'UTC'
  | 'Asia/Dubai'
  | 'Europe/London'
  | 'America/New_York';

export interface WorkspacePreferences {
  theme: ThemePreference;
  language: LanguagePreference;
  dateFormat: DateFormatPreference;
  timeFormat: TimeFormatPreference;
  timeZone: TimeZonePreference;
  showHeaderDateTime: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY =
  'unicolors.workspace.preferences.v1';

export const PREFERENCES_EVENT =
  'unicolors:workspace-preferences';

export const defaultWorkspacePreferences: WorkspacePreferences = {
  theme: 'system',
  language: 'en',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h',
  timeZone: 'Asia/Kolkata',
  showHeaderDateTime: true,
  reducedMotion: false,
};

const themes = new Set<ThemePreference>([
  'system',
  'light',
  'dark',
]);

const languages = new Set<LanguagePreference>([
  'en',
  'hi',
  'gu',
]);

const dateFormats = new Set<DateFormatPreference>([
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
]);

const timeFormats = new Set<TimeFormatPreference>([
  '12h',
  '24h',
]);

const timeZones = new Set<TimeZonePreference>([
  'Asia/Kolkata',
  'UTC',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
]);

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

function normalizePreferences(
  value: unknown,
): WorkspacePreferences {
  if (!isRecord(value)) {
    return defaultWorkspacePreferences;
  }

  const theme =
    typeof value.theme === 'string' &&
    themes.has(value.theme as ThemePreference)
      ? (value.theme as ThemePreference)
      : defaultWorkspacePreferences.theme;

  const language =
    typeof value.language === 'string' &&
    languages.has(
      value.language as LanguagePreference,
    )
      ? (value.language as LanguagePreference)
      : defaultWorkspacePreferences.language;

  const dateFormat =
    typeof value.dateFormat === 'string' &&
    dateFormats.has(
      value.dateFormat as DateFormatPreference,
    )
      ? (value.dateFormat as DateFormatPreference)
      : defaultWorkspacePreferences.dateFormat;

  const timeFormat =
    typeof value.timeFormat === 'string' &&
    timeFormats.has(
      value.timeFormat as TimeFormatPreference,
    )
      ? (value.timeFormat as TimeFormatPreference)
      : defaultWorkspacePreferences.timeFormat;

  const timeZone =
    typeof value.timeZone === 'string' &&
    timeZones.has(
      value.timeZone as TimeZonePreference,
    )
      ? (value.timeZone as TimeZonePreference)
      : defaultWorkspacePreferences.timeZone;

  return {
    theme,
    language,
    dateFormat,
    timeFormat,
    timeZone,
    showHeaderDateTime:
      typeof value.showHeaderDateTime ===
      'boolean'
        ? value.showHeaderDateTime
        : defaultWorkspacePreferences.showHeaderDateTime,
    reducedMotion:
      typeof value.reducedMotion === 'boolean'
        ? value.reducedMotion
        : defaultWorkspacePreferences.reducedMotion,
  };
}

export function loadWorkspacePreferences(): WorkspacePreferences {
  if (typeof window === 'undefined') {
    return defaultWorkspacePreferences;
  }

  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return defaultWorkspacePreferences;
    }

    return normalizePreferences(
      JSON.parse(raw),
    );
  } catch {
    return defaultWorkspacePreferences;
  }
}

export function persistWorkspacePreferences(
  preferences: WorkspacePreferences,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(preferences),
  );

  window.dispatchEvent(
    new CustomEvent(PREFERENCES_EVENT, {
      detail: preferences,
    }),
  );
}

export function useWorkspacePreferences() {
  const [preferences, setPreferencesState] =
    useState<WorkspacePreferences>(
      defaultWorkspacePreferences,
    );

  const [mounted, setMounted] =
    useState(false);

  useEffect(() => {
    setPreferencesState(
      loadWorkspacePreferences(),
    );
    setMounted(true);

    const sync = () => {
      setPreferencesState(
        loadWorkspacePreferences(),
      );
    };

    window.addEventListener(
      'storage',
      sync,
    );
    window.addEventListener(
      PREFERENCES_EVENT,
      sync,
    );

    return () => {
      window.removeEventListener(
        'storage',
        sync,
      );
      window.removeEventListener(
        PREFERENCES_EVENT,
        sync,
      );
    };
  }, []);

  const updatePreferences = useCallback(
    (
      patch:
        | Partial<WorkspacePreferences>
        | ((
            current: WorkspacePreferences,
          ) => Partial<WorkspacePreferences>),
    ) => {
      const current =
        loadWorkspacePreferences();

      const nextPatch =
        typeof patch === 'function'
          ? patch(current)
          : patch;

      const next = normalizePreferences({
        ...current,
        ...nextPatch,
      });

      setPreferencesState(next);
      persistWorkspacePreferences(next);
    },
    [],
  );

  const resetPreferences = useCallback(() => {
    persistWorkspacePreferences(
      defaultWorkspacePreferences,
    );
    setPreferencesState(
      defaultWorkspacePreferences,
    );
  }, []);

  return {
    preferences,
    updatePreferences,
    resetPreferences,
    mounted,
  };
}

export function getWorkspaceTimeZoneLabel(
  timeZone: TimeZonePreference,
) {
  if (timeZone === 'Asia/Kolkata') {
    return 'Ahmedabad, India (IST)';
  }

  if (timeZone === 'Asia/Dubai') {
    return 'Dubai';
  }

  if (timeZone === 'Europe/London') {
    return 'London';
  }

  if (timeZone === 'America/New_York') {
    return 'New York';
  }

  return 'UTC';
}

export function getResolvedTheme(
  theme: ThemePreference,
): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  if (
    typeof window !== 'undefined' &&
    window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches
  ) {
    return 'dark';
  }

  return 'light';
}

function getDateParts(
  date: Date,
  timeZone: TimeZonePreference,
) {
  const parts =
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(date);

  const read = (type: string) =>
    parts.find((part) => part.type === type)
      ?.value ?? '';

  return {
    day: read('day'),
    month: read('month'),
    year: read('year'),
  };
}

export function formatWorkspaceDate(
  date: Date,
  preferences: WorkspacePreferences,
) {
  const { day, month, year } =
    getDateParts(
      date,
      preferences.timeZone,
    );

  if (
    preferences.dateFormat === 'MM/DD/YYYY'
  ) {
    return `${month}/${day}/${year}`;
  }

  if (
    preferences.dateFormat === 'YYYY-MM-DD'
  ) {
    return `${year}-${month}-${day}`;
  }

  return `${day}/${month}/${year}`;
}

export function formatWorkspaceTime(
  date: Date,
  preferences: WorkspacePreferences,
) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: preferences.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: preferences.timeFormat === '12h',
  }).format(date);
}

export function formatWorkspaceDateTime(
  date: Date,
  preferences: WorkspacePreferences,
) {
  return `${formatWorkspaceDate(
    date,
    preferences,
  )} · ${formatWorkspaceTime(
    date,
    preferences,
  )}`;
}
