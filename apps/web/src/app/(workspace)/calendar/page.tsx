'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  Filter,
  Loader2,
  PauseCircle,
  PlayCircle,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

type View = 'month' | 'week' | 'day';
type EventType = 'TASK' | 'PROJECT_DEADLINE' | 'MILESTONE' | 'RECURRING' | 'LEAVE';

type CalendarEvent = {
  id: string;
  type: EventType;
  title: string;
  date: string;
  priority?: string;
  critical?: boolean;
  frequency?: string;
  interval?: number;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  redirectPath?: string | null;
};

type Options = {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; clientId: string }>;
  departments: Array<{ id: string; name: string }>;
  employees: Array<{
    id: string;
    fullName: string;
    username?: string | null;
    departmentId?: string | null;
    employmentStatus: string;
  }>;
  priorities: string[];
};

type Recurring = {
  id: string;
  frequency: string;
  interval: number;
  weekdays: number[];
  dayOfMonth?: number | null;
  startAt: string;
  endAt?: string | null;
  nextRunAt?: string | null;
  isActive: boolean;
  templateTask: {
    id: string;
    title: string;
    priority: string;
    client: { id: string; name: string };
    project: { id: string; name: string };
  };
};

type Template = {
  id: string;
  title: string;
  project: { id: string; name: string };
  client: { id: string; name: string };
};

type Filters = {
  employeeId: string;
  clientId: string;
  projectId: string;
  departmentId: string;
  priority: string;
};

const blankFilters: Filters = {
  employeeId: '',
  clientId: '',
  projectId: '',
  departmentId: '',
  priority: '',
};

const startOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const addDays = (date: Date, amount: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
};

const startOfWeek = (date: Date) => {
  const value = startOfDay(date);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return value;
};

const monthGridStart = (date: Date) =>
  startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const localDateTimeValue = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
};

const eventLabel = (event: CalendarEvent) => {
  if (event.type === 'TASK') return event.critical ? 'Critical Task' : 'Task';
  if (event.type === 'PROJECT_DEADLINE') return 'Project Deadline';
  if (event.type === 'MILESTONE') return 'Milestone';
  if (event.type === 'RECURRING') return 'Recurring';
  return 'Leave';
};

const eventClass = (type: EventType) => {
  if (type === 'TASK') return 'border-blue-200 bg-blue-50 text-blue-900';
  if (type === 'PROJECT_DEADLINE') return 'border-violet-200 bg-violet-50 text-violet-900';
  if (type === 'MILESTONE') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (type === 'RECURRING') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-rose-200 bg-rose-50 text-rose-900';
};

export default function CalendarPage() {
  const router = useRouter();
  const { authFetch, hasPermission } = useAuth();

  const [view, setView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [options, setOptions] = useState<Options>({
    clients: [],
    projects: [],
    departments: [],
    employees: [],
    priorities: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
  });
  const [filters, setFilters] = useState<Filters>(blankFilters);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    templateTaskId: '',
    frequency: 'DAILY',
    interval: 1,
    weekdays: [] as number[],
    dayOfMonth: new Date().getDate(),
    startAt: localDateTimeValue(new Date()),
    endAt: '',
  });

  const canCreate = hasPermission('tasks.create');
  const canUpdate = hasPermission('tasks.update');
  const canDelete = hasPermission('tasks.delete');

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await authFetch(path, init);
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Request failed.';
        throw new Error(message);
      }
      return data as T;
    },
    [authFetch],
  );

  const range = useMemo(() => {
    if (view === 'day') {
      const start = startOfDay(currentDate);
      return { start, end: addDays(start, 1) };
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate);
      return { start, end: addDays(start, 7) };
    }
    const start = monthGridStart(currentDate);
    return { start, end: addDays(start, 42) };
  }, [currentDate, view]);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const result = await api<{ events: CalendarEvent[] }>(
        `/calendar/events?${params.toString()}`,
      );
      setEvents(result.events);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load calendar.');
    } finally {
      setLoading(false);
    }
  }, [api, filters, range.end, range.start]);

  const loadStatic = useCallback(async () => {
    try {
      const [calendarOptions, recurringItems] = await Promise.all([
        api<Options>('/calendar/options'),
        api<Recurring[]>('/recurring-tasks'),
      ]);
      setOptions(calendarOptions);
      setRecurring(recurringItems);

      if (canCreate) {
        const taskTemplates = await api<Template[]>('/recurring-tasks/options/templates');
        setTemplates(taskTemplates);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load calendar options.');
    }
  }, [api, canCreate]);

  useEffect(() => {
    void loadStatic();
  }, [loadStatic]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const days = useMemo(() => {
    const count = view === 'month' ? 42 : view === 'week' ? 7 : 1;
    const start = view === 'month' ? monthGridStart(currentDate) : view === 'week' ? startOfWeek(currentDate) : startOfDay(currentDate);
    return Array.from({ length: count }, (_, index) => addDays(start, index));
  }, [currentDate, view]);

  const title = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    }
    if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      return `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentDate, view]);

  const eventsOn = (day: Date) => events.filter((item) => sameDay(new Date(item.date), day));

  const move = (direction: number) => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + direction);
    else if (view === 'week') next.setDate(next.getDate() + 7 * direction);
    else next.setMonth(next.getMonth() + direction);
    setCurrentDate(next);
  };

  const refreshAll = async () => {
    await Promise.all([loadStatic(), loadEvents()]);
  };

  const createRecurring = async () => {
    if (!form.templateTaskId) {
      setError('Select a template task.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body: any = {
        templateTaskId: form.templateTaskId,
        frequency: form.frequency,
        interval: Number(form.interval),
        startAt: new Date(form.startAt).toISOString(),
      };
      if (form.endAt) body.endAt = new Date(form.endAt).toISOString();
      if (form.frequency === 'WEEKLY') body.weekdays = form.weekdays;
      if (form.frequency === 'MONTHLY') body.dayOfMonth = Number(form.dayOfMonth);

      await api('/recurring-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setShowForm(false);
      setSuccess('Recurring schedule created.');
      await refreshAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create recurring task.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: Recurring) => {
    setError('');
    try {
      await api(`/recurring-tasks/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await refreshAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update recurring task.');
    }
  };

  const runNow = async (item: Recurring) => {
    setError('');
    setSuccess('');
    try {
      await api(`/recurring-tasks/${item.id}/run-now`, { method: 'POST' });
      setSuccess(`New task generated from “${item.templateTask.title}”.`);
      await refreshAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not generate task.');
    }
  };

  const remove = async (item: Recurring) => {
    if (!window.confirm(`Remove recurring schedule for “${item.templateTask.title}”?`)) return;
    setError('');
    try {
      await api(`/recurring-tasks/${item.id}`, { method: 'DELETE' });
      await refreshAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not remove recurring task.');
    }
  };

  const visibleProjects = options.projects.filter(
    (project) => !filters.clientId || project.clientId === filters.clientId,
  );

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
            <CalendarDays className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Calendar</h1>
          </div>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white"
          >
            <CirclePlus className="h-4 w-4" />
            Create Recurring Task
          </button>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{success}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-700"><Filter className="h-4 w-4" /> Filters</div>

          <select value={filters.employeeId} onChange={(e) => setFilters((x) => ({ ...x, employeeId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Employees</option>
            {options.employees.map((item) => <option key={item.id} value={item.id}>{item.fullName}{item.username ? ` (@${item.username})` : ''}</option>)}
          </select>

          <select value={filters.clientId} onChange={(e) => setFilters((x) => ({ ...x, clientId: e.target.value, projectId: '' }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Clients</option>
            {options.clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <select value={filters.projectId} onChange={(e) => setFilters((x) => ({ ...x, projectId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {visibleProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <select value={filters.departmentId} onChange={(e) => setFilters((x) => ({ ...x, departmentId: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Departments</option>
            {options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>

          <select value={filters.priority} onChange={(e) => setFilters((x) => ({ ...x, priority: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Priorities</option>
            {options.priorities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>

          {Object.values(filters).some(Boolean) && (
            <button type="button" onClick={() => setFilters(blankFilters)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /> Clear</button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => move(-1)} className="rounded-xl border border-slate-200 p-2"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setCurrentDate(new Date())} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Today</button>
            <button type="button" onClick={() => move(1)} className="rounded-xl border border-slate-200 p-2"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {(['day', 'week', 'month'] as View[]).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={`rounded-lg px-3 py-1.5 text-xs font-black capitalize ${view === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{item}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[440px] items-center justify-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading calendar...</div>
        ) : view === 'month' ? (
          <>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => <div key={name} className="px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-slate-400">{name}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const items = eventsOn(day);
                const outside = day.getMonth() !== currentDate.getMonth();
                return (
                  <div key={day.toISOString()} className={`min-h-[135px] border-b border-r border-slate-100 p-2 ${outside ? 'bg-slate-50/60' : ''}`}>
                    <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${sameDay(day, new Date()) ? 'bg-blue-600 text-white' : outside ? 'text-slate-300' : 'text-slate-600'}`}>{day.getDate()}</div>
                    <div className="space-y-1.5">
                      {items.slice(0, 4).map((event) => (
                        <button key={event.id} type="button" onClick={() => event.redirectPath && router.push(event.redirectPath)} className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] font-bold leading-4 ${eventClass(event.type)}`}>
                          <div className="truncate">{event.title}</div>
                          <div className="mt-0.5 truncate opacity-70">{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {eventLabel(event)}</div>
                        </button>
                      ))}
                      {items.length > 4 && <div className="px-1 text-[11px] font-bold text-slate-400">+{items.length - 4} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : view === 'week' ? (
          <div className="grid min-h-[520px] grid-cols-7">
            {days.map((day) => (
              <div key={day.toISOString()} className="border-r border-slate-100 p-3">
                <div className="mb-4 text-center">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">{day.toLocaleDateString(undefined, { weekday: 'short' })}</p>
                  <p className={`mx-auto mt-2 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${sameDay(day, new Date()) ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>{day.getDate()}</p>
                </div>
                <div className="space-y-2">
                  {eventsOn(day).map((event) => (
                    <button key={event.id} type="button" onClick={() => event.redirectPath && router.push(event.redirectPath)} className={`w-full rounded-xl border p-2.5 text-left text-xs ${eventClass(event.type)}`}>
                      <p className="font-black">{event.title}</p>
                      <p className="mt-1 opacity-70">{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {eventLabel(event)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="min-h-[520px] p-5">
            <div className="space-y-3">
              {eventsOn(days[0]).length === 0 ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm font-bold text-slate-400">No calendar items for this day.</div>
              ) : eventsOn(days[0]).map((event) => (
                <button key={event.id} type="button" onClick={() => event.redirectPath && router.push(event.redirectPath)} className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left ${eventClass(event.type)}`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70">{event.type === 'RECURRING' ? <Repeat2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}</div>
                  <div>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">{eventLabel(event)}</span>
                    <p className="mt-2 font-black">{event.title}</p>
                    <p className="mt-1 text-xs opacity-70">{new Date(event.date).toLocaleString()}{event.project?.name ? ` · ${event.project.name}` : ''}{event.client?.name ? ` · ${event.client.name}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2"><Repeat2 className="h-5 w-5 text-emerald-600" /><h2 className="font-black text-slate-950">Recurring Tasks</h2></div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">{recurring.filter((item) => item.isActive).length} Active</span>
        </div>

        <div className="divide-y divide-slate-100">
          {recurring.length === 0 ? <div className="p-8 text-center text-sm font-semibold text-slate-400">No recurring schedules yet.</div> : recurring.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="flex items-center gap-2"><p className="font-black text-slate-900">{item.templateTask.title}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.isActive ? 'Active' : 'Paused'}</span></div>
                <p className="mt-1 text-xs text-slate-500">Every {item.interval > 1 ? `${item.interval} ` : ''}{item.frequency.toLowerCase()}{item.interval > 1 ? 's' : ''} · {item.templateTask.project.name}</p>
                <p className="mt-1 text-xs text-slate-400">Next: {item.nextRunAt ? new Date(item.nextRunAt).toLocaleString() : 'No next run'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canCreate && item.isActive && <button type="button" onClick={() => void runNow(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black"><PlayCircle className="h-4 w-4" /> Run Now</button>}
                {canUpdate && <button type="button" onClick={() => void toggle(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black">{item.isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}{item.isActive ? 'Pause' : 'Resume'}</button>}
                {canDelete && <button type="button" onClick={() => void remove(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-100 px-3 py-2 text-xs font-black text-red-600"><Trash2 className="h-4 w-4" /> Remove</button>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div><h2 className="text-lg font-black">Create Recurring Task</h2></div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 p-5">
              <label className="block"><span className="text-sm font-black text-slate-700">Template Task</span><select value={form.templateTaskId} onChange={(e) => setForm((x) => ({ ...x, templateTaskId: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="">Select task</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.title} — {item.project.name}</option>)}</select></label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-black text-slate-700">Frequency</span><select value={form.frequency} onChange={(e) => setForm((x) => ({ ...x, frequency: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>
                <label className="block"><span className="text-sm font-black text-slate-700">Repeat Every</span><input type="number" min={1} max={365} value={form.interval} onChange={(e) => setForm((x) => ({ ...x, interval: Number(e.target.value) || 1 }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
              </div>

              {form.frequency === 'WEEKLY' && <div><span className="text-sm font-black text-slate-700">Weekdays</span><div className="mt-2 flex flex-wrap gap-2">{weekdayNames.map((name, index) => { const active = form.weekdays.includes(index); return <button key={name} type="button" onClick={() => setForm((x) => ({ ...x, weekdays: active ? x.weekdays.filter((day) => day !== index) : [...x.weekdays, index] }))} className={`rounded-xl border px-3 py-2 text-xs font-black ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-600'}`}>{name}</button>; })}</div></div>}

              {form.frequency === 'MONTHLY' && <label className="block"><span className="text-sm font-black text-slate-700">Day of Month</span><input type="number" min={1} max={31} value={form.dayOfMonth} onChange={(e) => setForm((x) => ({ ...x, dayOfMonth: Number(e.target.value) || 1 }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-black text-slate-700">Start</span><input type="datetime-local" value={form.startAt} onChange={(e) => setForm((x) => ({ ...x, startAt: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
                <label className="block"><span className="text-sm font-black text-slate-700">End (Optional)</span><input type="datetime-local" value={form.endAt} onChange={(e) => setForm((x) => ({ ...x, endAt: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" /></label>
              </div>

              <button type="button" disabled={saving} onClick={() => void createRecurring()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />} Create Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
