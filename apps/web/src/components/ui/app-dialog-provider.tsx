'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';

type DialogKind =
  | 'alert'
  | 'confirm'
  | 'prompt';

type DialogTone =
  | 'default'
  | 'danger';

type DialogOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  required?: boolean;
  tone?: DialogTone;
};

type DialogRequest = {
  id: number;
  kind: DialogKind;
  options: DialogOptions;
  resolve: (value: unknown) => void;
};

type AppDialogApi = {
  alert: (
    options: DialogOptions | string,
  ) => Promise<void>;
  confirm: (
    options: DialogOptions | string,
  ) => Promise<boolean>;
  prompt: (
    options: DialogOptions | string,
  ) => Promise<string | null>;
};

const DialogContext =
  createContext<AppDialogApi | null>(
    null,
  );

let imperativeApi:
  | AppDialogApi
  | null = null;

export const appDialog: AppDialogApi = {
  alert: async (options) => {
    if (!imperativeApi) return;
    await imperativeApi.alert(options);
  },

  confirm: async (options) => {
    if (!imperativeApi) {
      return false;
    }

    return imperativeApi.confirm(
      options,
    );
  },

  prompt: async (options) => {
    if (!imperativeApi) {
      return null;
    }

    return imperativeApi.prompt(
      options,
    );
  },
};

function normalizeOptions(
  options: DialogOptions | string,
  fallbackTitle: string,
): DialogOptions {
  if (typeof options === 'string') {
    return {
      title: fallbackTitle,
      message: options,
    };
  }

  return options;
}

export function AppDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] =
    useState<DialogRequest | null>(
      null,
    );

  const [inputValue, setInputValue] =
    useState('');

  const activeRef =
    useRef<DialogRequest | null>(
      null,
    );

  const queueRef =
    useRef<DialogRequest[]>([]);

  const nextIdRef = useRef(1);

  const showNext = () => {
    const next =
      queueRef.current.shift() ??
      null;

    activeRef.current = next;
    setActive(next);
  };

  const finish = (
    value: unknown,
  ) => {
    const current =
      activeRef.current;

    if (!current) return;

    current.resolve(value);
    showNext();
  };

  const enqueue = (
    kind: DialogKind,
    options: DialogOptions,
  ) =>
    new Promise<unknown>((resolve) => {
      const request: DialogRequest = {
        id: nextIdRef.current++,
        kind,
        options,
        resolve,
      };

      if (!activeRef.current) {
        activeRef.current =
          request;
        setActive(request);
        return;
      }

      queueRef.current.push(
        request,
      );
    });

  const api = useMemo<AppDialogApi>(
    () => ({
      alert: async (
        options,
      ) => {
        await enqueue(
          'alert',
          normalizeOptions(
            options,
            'Notice',
          ),
        );
      },

      confirm: async (
        options,
      ) =>
        Boolean(
          await enqueue(
            'confirm',
            normalizeOptions(
              options,
              'Confirm action',
            ),
          ),
        ),

      prompt: async (
        options,
      ) => {
        const result =
          await enqueue(
            'prompt',
            normalizeOptions(
              options,
              'Add details',
            ),
          );

        return typeof result ===
          'string'
          ? result
          : null;
      },
    }),
    [],
  );

  useEffect(() => {
    imperativeApi = api;

    return () => {
      if (
        imperativeApi === api
      ) {
        imperativeApi = null;
      }
    };
  }, [api]);

  useEffect(() => {
    setInputValue(
      active?.options
        .defaultValue ?? '',
    );
  }, [active?.id]);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();

      if (
        active.kind ===
        'alert'
      ) {
        finish(undefined);
        return;
      }

      finish(
        active.kind ===
          'confirm'
          ? false
          : null,
      );
    };

    window.addEventListener(
      'keydown',
      onKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown,
      );
    };
  }, [active]);

  const confirmDisabled =
    active?.kind ===
      'prompt' &&
    active.options.required &&
    !inputValue.trim();

  return (
    <DialogContext.Provider
      value={api}
    >
      {children}

      {active && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`app-dialog-title-${active.id}`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id={`app-dialog-title-${active.id}`}
                  className="text-base font-bold text-slate-950"
                >
                  {
                    active
                      .options
                      .title
                  }
                </h3>

                {active.options
                  .message && (
                  <p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-500">
                    {
                      active
                        .options
                        .message
                    }
                  </p>
                )}
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (
                    active.kind ===
                    'alert'
                  ) {
                    finish(
                      undefined,
                    );
                    return;
                  }

                  finish(
                    active.kind ===
                      'confirm'
                      ? false
                      : null,
                  );
                }}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {active.kind ===
              'prompt' &&
              (active.options
                .multiline ? (
                <textarea
                  autoFocus
                  rows={3}
                  value={
                    inputValue
                  }
                  onChange={(
                    event,
                  ) =>
                    setInputValue(
                      event
                        .target
                        .value,
                    )
                  }
                  placeholder={
                    active
                      .options
                      .placeholder
                  }
                  className="mt-4 min-h-24 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                />
              ) : (
                <input
                  autoFocus
                  value={
                    inputValue
                  }
                  onChange={(
                    event,
                  ) =>
                    setInputValue(
                      event
                        .target
                        .value,
                    )
                  }
                  onKeyDown={(
                    event,
                  ) => {
                    if (
                      event.key ===
                        'Enter' &&
                      !confirmDisabled
                    ) {
                      event.preventDefault();
                      finish(
                        inputValue,
                      );
                    }
                  }}
                  placeholder={
                    active
                      .options
                      .placeholder
                  }
                  className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-400"
                />
              ))}

            <div className="mt-4 flex justify-end gap-2">
              {active.kind !==
                'alert' && (
                <button
                  type="button"
                  onClick={() =>
                    finish(
                      active.kind ===
                        'confirm'
                        ? false
                        : null,
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {active.options
                    .cancelLabel ??
                    'Cancel'}
                </button>
              )}

              <button
                type="button"
                disabled={
                  confirmDisabled
                }
                onClick={() => {
                  if (
                    active.kind ===
                    'alert'
                  ) {
                    finish(
                      undefined,
                    );
                    return;
                  }

                  if (
                    active.kind ===
                    'confirm'
                  ) {
                    finish(true);
                    return;
                  }

                  finish(
                    inputValue,
                  );
                }}
                className={
                  active.options
                    .tone ===
                  'danger'
                    ? 'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50'
                    : 'rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50'
                }
              >
                {active.options
                  .confirmLabel ??
                  (active.kind ===
                  'alert'
                    ? 'OK'
                    : 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useAppDialog() {
  const context =
    useContext(DialogContext);

  if (!context) {
    throw new Error(
      'useAppDialog must be used inside AppDialogProvider.',
    );
  }

  return context;
}
