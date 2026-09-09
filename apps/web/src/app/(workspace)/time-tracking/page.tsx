'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, Pause, Play, RotateCcw, Square, TimerReset } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';

type Entry = {
  id: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  workDate: string;
  activeStartedAt?: string | null;
  durationSeconds: number;
  effectiveDurationSeconds: number;
  isManual: boolean;
  notes?: string | null;
  employee: { id: string; fullName: string; username?: string | null };
  project: { id: string; name: string; client: { id: string; name: string } };
  task?: { id: string; title: string; estimatedHours?: string | number | null } | null;
};

type Options = {
  projects: Array<{ id: string; name: string; client: { id: string; name: string } }>;
  tasks: Array<{
    id: string;
    title: string;
    projectId: string;
    estimatedHours?: string | number | null;
    project: { id: string; name: string };
  }>;
  employees: Array<{ id: string; fullName: string; username?: string | null }>;
};

type Summary = {
  totals: {
    totalSeconds: number;
    timerSeconds: number;
    manualSeconds: number;
    entryCount: number;
  };
  byProject: Array<{
    projectId: string;
    projectName: string;
    clientName: string;
    seconds: number;
    entries: number;
  }>;
  byEmployee: Array<{
    employeeId: string;
    employeeName: string;
    seconds: number;
    entries: number;
  }>;
  estimatedVsActual: Array<{
    taskId: string;
    title: string;
    estimatedHours: number;
    actualSeconds: number;
  }>;
};

function duration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function hours(seconds: number) {
  return `${(seconds / 3600).toFixed(2)} h`;
}

function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function monday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export default function TimeTrackingPage() {
  const { authFetch, hasPermission } = useAuth();
  const [options, setOptions] = useState<Options>({ projects: [], tasks: [], employees: [] });
  const [current, setCurrent] = useState<Entry | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [startDate, setStartDate] = useState(localDateTime(monday()).slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = monday();
    d.setDate(d.getDate() + 7);
    return localDateTime(d).slice(0, 10);
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tick, setTick] = useState(Date.now());

  const canViewTeam = hasPermission('time.view_all');

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await authFetch(path, init);
      let data: any = null;
      try {
        data = await response.json();
      } catch {}
      if (!response.ok) {
        const message = Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message ?? 'Request failed.';
        throw new Error(message);
      }
      return data as T;
    },
    [authFetch],
  );

  const params = useCallback(() => {
    const p = new URLSearchParams();
    p.set('start', new Date(`${startDate}T00:00:00`).toISOString());
    p.set('end', new Date(`${endDate}T00:00:00`).toISOString());
    if (employeeId) p.set('employeeId', employeeId);
    if (filterProjectId) p.set('projectId', filterProjectId);
    return p;
  }, [startDate, endDate, employeeId, filterProjectId]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const p = params();
        const [o, c, l, s] = await Promise.all([
          request<Options>('/time-entries/options'),
          request<Entry | null>('/time-entries/current'),
          request<{ entries: Entry[] }>(`/time-entries?${p.toString()}`),
          request<Summary>(`/time-entries/summary?${p.toString()}`),
        ]);
        setOptions(o);
        setCurrent(c);
        setEntries(l.entries);
        setSummary(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load time tracking.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [params, request],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (current?.status !== 'RUNNING') return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [current?.status]);

  const liveSeconds = useMemo(() => {
    if (!current) return 0;
    if (current.status !== 'RUNNING' || !current.activeStartedAt) {
      return current.effectiveDurationSeconds;
    }
    return (
      current.durationSeconds +
      Math.max(0, Math.floor((tick - new Date(current.activeStartedAt).getTime()) / 1000))
    );
  }, [current, tick]);

  const availableTasks = options.tasks.filter((t) => !projectId || t.projectId === projectId);

  async function startTimer() {
    if (!projectId) return setError('Select a project first.');
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await request('/time-entries/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, taskId: taskId || undefined, notes: notes || undefined }),
      });
      setSuccess('Timer started.');
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start timer.');
    } finally {
      setBusy(false);
    }
  }

  async function timerAction(action: 'pause' | 'resume' | 'stop') {
    if (!current) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await request(`/time-entries/${current.id}/${action}`, { method: 'PATCH' });
      setSuccess(`Timer ${action === 'pause' ? 'paused' : action === 'resume' ? 'resumed' : 'stopped'}.`);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Timer action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const p = String(form.get('projectId') ?? '');
    const t = String(form.get('taskId') ?? '');
    const workDate = String(form.get('workDate') ?? '');
    const h = Number(form.get('hours') ?? 0);
    const m = Number(form.get('minutes') ?? 0);
    const n = String(form.get('notes') ?? '');
    const durationMinutes = Math.round(h * 60 + m);
    if (!p || !workDate || durationMinutes < 1) {
      return setError('Project, work date and duration are required.');
    }

    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await request('/time-entries/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: p,
          taskId: t || undefined,
          workDate: new Date(workDate).toISOString(),
          durationMinutes,
          notes: n || undefined,
        }),
      });
      setSuccess('Manual time entry added.');
      formElement.reset();
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to add manual time.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading time tracking...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-950">Time Tracking</h1>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
      {success && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{success}</div>}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">Current Timer</p>
              <h2 className="mt-2 text-xl font-black text-slate-950">
                {current?.task?.title ?? current?.project.name ?? 'No active timer'}
              </h2>
              {current && <p className="mt-1 text-sm text-slate-500">{current.project.name} · {current.project.client.name}</p>}
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{current?.status ?? 'STOPPED'}</span>
          </div>

          <div className="my-8 text-center font-mono text-5xl font-black text-slate-950">{duration(liveSeconds)}</div>

          {current ? (
            <div className="flex justify-center gap-3">
              {current.status === 'RUNNING' && (
                <button disabled={busy} onClick={() => void timerAction('pause')} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-white">
                  <Pause className="h-4 w-4" /> Pause
                </button>
              )}
              {current.status === 'PAUSED' && (
                <button disabled={busy} onClick={() => void timerAction('resume')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">
                  <RotateCcw className="h-4 w-4" /> Resume
                </button>
              )}
              <button disabled={busy} onClick={() => void timerAction('stop')} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
                <Square className="h-4 w-4" /> Stop
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTaskId(''); }} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
                <option value="">Select Project</option>
                {options.projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.client.name}</option>)}
              </select>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-3 text-sm">
                <option value="">Project only / Select Task</option>
                {availableTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work note (optional)" className="rounded-xl border border-slate-200 px-3 py-3 text-sm sm:col-span-2" />
              <button disabled={busy || !projectId} onClick={() => void startTimer()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50 sm:col-span-2">
                <Play className="h-4 w-4" /> Start Timer
              </button>
            </div>
          )}
        </section>

        <form onSubmit={addManual} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2"><TimerReset className="h-5 w-5 text-violet-600" /><h2 className="font-black text-slate-950">Manual Time Entry</h2></div>
          <div className="mt-5 space-y-3">
            <select name="projectId" required className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">
              <option value="">Select Project</option>
              {options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="taskId" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">
              <option value="">Task optional</option>
              {options.tasks.map((t) => <option key={t.id} value={t.id}>{t.title} — {t.project.name}</option>)}
            </select>
            <input type="datetime-local" name="workDate" required defaultValue={localDateTime(new Date())} className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" name="hours" min={0} max={24} step="0.25" placeholder="Hours" className="rounded-xl border border-slate-200 px-3 py-3 text-sm" />
              <input type="number" name="minutes" min={0} max={59} placeholder="Minutes" className="rounded-xl border border-slate-200 px-3 py-3 text-sm" />
            </div>
            <textarea name="notes" rows={3} placeholder="Work note" className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Add Manual Time</button>
          </div>
        </form>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label><span className="block text-xs font-black uppercase text-slate-400">From</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <label><span className="block text-xs font-black uppercase text-slate-400">To</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
          <select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Projects</option>
            {options.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {canViewTeam && (
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">My Team / All Allowed</option>
              {options.employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
          )}
          <button onClick={() => void load()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">Apply</button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Project-wise Time</h2>
          <div className="mt-4 space-y-3">
            {summary?.byProject.length ? summary.byProject.map((i) => (
              <div key={i.projectId} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div><p className="text-sm font-black text-slate-800">{i.projectName}</p><p className="text-xs text-slate-400">{i.clientName} · {i.entries} entries</p></div>
                <span className="text-sm font-black">{hours(i.seconds)}</span>
              </div>
            )) : <p className="text-sm text-slate-400">No time logged.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Employee-wise Time</h2>
          <div className="mt-4 space-y-3">
            {summary?.byEmployee.length ? summary.byEmployee.map((i) => (
              <div key={i.employeeId} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div><p className="text-sm font-black text-slate-800">{i.employeeName}</p><p className="text-xs text-slate-400">{i.entries} entries</p></div>
                <span className="text-sm font-black">{hours(i.seconds)}</span>
              </div>
            )) : <p className="text-sm text-slate-400">No employee time.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-black text-slate-950">Estimated vs Actual</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400"><th className="py-3">Task</th><th>Estimated</th><th>Actual</th><th>Difference</th></tr></thead>
            <tbody>
              {summary?.estimatedVsActual.map((i) => {
                const actual = i.actualSeconds / 3600;
                const diff = actual - i.estimatedHours;
                return <tr key={i.taskId} className="border-b border-slate-50"><td className="py-3 font-bold">{i.title}</td><td>{i.estimatedHours.toFixed(2)} h</td><td>{actual.toFixed(2)} h</td><td className={diff > 0 ? 'font-black text-red-600' : 'font-black text-emerald-600'}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)} h</td></tr>;
              })}
              {!summary?.estimatedVsActual.length && <tr><td colSpan={4} className="py-8 text-center text-slate-400">No task-linked entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-black text-slate-950">Daily / Weekly Time Log</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead><tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400"><th className="py-3">Date</th><th>Employee</th><th>Project</th><th>Task</th><th>Type</th><th>Status</th><th>Time</th><th>Notes</th></tr></thead>
            <tbody>
              {entries.map((e) => <tr key={e.id} className="border-b border-slate-50"><td className="py-3 pr-3">{new Date(e.workDate).toLocaleString()}</td><td className="pr-3 font-bold">{e.employee.fullName}</td><td className="pr-3">{e.project.name}</td><td className="pr-3">{e.task?.title ?? '—'}</td><td className="pr-3">{e.isManual ? 'Manual' : 'Timer'}</td><td className="pr-3 font-black">{e.status}</td><td className="pr-3 font-mono font-black">{duration(e.effectiveDurationSeconds)}</td><td className="text-slate-500">{e.notes ?? '—'}</td></tr>)}
              {!entries.length && <tr><td colSpan={8} className="py-10 text-center text-slate-400">No time entries found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
