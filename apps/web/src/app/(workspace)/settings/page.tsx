'use client';

import {
  CalendarClock,
  Check,
  Languages,
  Monitor,
  Moon,
  RefreshCcw,
  Sun,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

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

export default function SettingsPage() {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
  } = useWorkspacePreferences();

  const [now, setNow] =
    useState(() => new Date());
  const [saved, setSaved] =
    useState(false);

  const text = copy[preferences.language];

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      30_000,
    );

    return () =>
      window.clearInterval(timer);
  }, []);

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
