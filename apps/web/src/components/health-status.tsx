'use client';
import { useEffect, useState } from 'react';
import {
  getApiHealth,
  type HealthResponse,
} from '@/lib/api';

type RequestStatus = 'loading' | 'success' | 'error';

export function HealthStatus() {
  const [status, setStatus] = useState<RequestStatus>('loading');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        const response = await getApiHealth();

        if (!isMounted) {
          return;
        }

        setHealth(response);
        setStatus('success');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to connect to the backend',
        );

        setStatus('error');
      }
    }

    void checkHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          Checking system connection…
        </p>

        <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-slate-200" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">
          Backend connection failed
        </p>

        <p className="mt-2 text-sm text-red-600">
          {errorMessage}
        </p>

        <p className="mt-3 text-xs text-red-500">
          Make sure the NestJS server is running on port 4000.
        </p>
      </div>
    );
  }

  const databaseConnected =
    health?.data.dependencies.database === 'connected';

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-emerald-800">
            Backend connected
          </p>

          <p className="mt-1 text-sm text-emerald-700">
            {health?.message}
          </p>
        </div>

        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
          Healthy
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StatusItem
          label="API"
          value={health?.data.service ?? 'Unknown'}
          connected
        />

        <StatusItem
          label="PostgreSQL"
          value={databaseConnected ? 'Connected' : 'Disconnected'}
          connected={databaseConnected}
        />

        <StatusItem
          label="Redis"
          value={health?.data.dependencies.redis ?? 'Not configured'}
          connected={health?.data.dependencies.redis === 'connected'}
        />

        <StatusItem
          label="Storage"
          value={health?.data.dependencies.storage ?? 'Not configured'}
          connected={health?.data.dependencies.storage === 'connected'}
        />
      </div>
    </div>
  );
}

type StatusItemProps = {
  label: string;
  value: string;
  connected: boolean;
};

function StatusItem({
  label,
  value,
  connected,
}: StatusItemProps) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />

        <p className="text-sm font-semibold text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}