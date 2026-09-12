'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FileAudio,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Save,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { appDialog } from '@/components/ui/app-dialog-provider';

interface PersonProfile {
  username?: string | null;
  fullName: string;
}

interface UserSummary {
  id: string;
  email?: string | null;
  phone?: string | null;
  employeeProfile?: PersonProfile | null;
}

interface VoiceNote {
  id: string;
  taskId: string;
  uploadedById: string;
  originalName?: string | null;
  mimeType: string;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  transcript?: string | null;
  transcriptEditedAt?: string | null;
  transcriptionStatus:
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED';
  language?: string | null;
  provider?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy: UserSummary;
}

interface Props {
  taskId: string;
  canUpload: boolean;
  canDownload: boolean;
  canManageFiles: boolean;
  onChanged?: () => void;
}

function getErrorMessage(
  value: unknown,
  fallback: string,
) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'message' in value
  ) {
    const message = (
      value as {
        message?: string | string[];
      }
    ).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }
  }

  return fallback;
}

function displayName(
  user?: UserSummary | null,
) {
  const profile =
    user?.employeeProfile;

  if (profile?.fullName) {
    return profile.username
      ? `${profile.fullName} (@${profile.username})`
      : profile.fullName;
  }

  return (
    user?.email ||
    user?.phone ||
    'Team member'
  );
}

function dateTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function formatBytes(
  value?: number | null,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function formatDuration(
  value?: number | null,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  const minutes =
    Math.floor(
      value / 60,
    );

  const seconds =
    value % 60;

  return `${minutes}:${String(
    seconds,
  ).padStart(2, '0')}`;
}

function preferredMimeType() {
  if (
    typeof MediaRecorder ===
    'undefined'
  ) {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];

  return (
    candidates.find(
      (type) =>
        MediaRecorder.isTypeSupported(
          type,
        ),
    ) || ''
  );
}

function extensionForMime(
  mimeType: string,
) {
  if (
    mimeType.includes('ogg')
  ) {
    return 'ogg';
  }

  if (
    mimeType.includes('mp4')
  ) {
    return 'm4a';
  }

  return 'webm';
}

function statusLabel(
  note: VoiceNote,
) {
  if (
    note.provider ===
      'MANUAL'
  ) {
    return 'Manual transcript';
  }

  if (
    note.transcriptionStatus ===
      'PROCESSING'
  ) {
    return 'Transcribing locally...';
  }

  if (
    note.transcriptionStatus ===
      'PENDING'
  ) {
    return 'Waiting for local transcription';
  }

  if (
    note.transcriptionStatus ===
      'FAILED'
  ) {
    return 'Transcription failed';
  }

  if (
    note.provider?.startsWith(
      'LOCAL_FASTER_WHISPER',
    )
  ) {
    return 'Local AI transcript';
  }

  return 'Transcript ready';
}

export function TaskVoiceNotesPanel({
  taskId,
  canUpload,
  canDownload,
  canManageFiles,
  onChanged,
}: Props) {
  const {
    authFetch,
    user,
  } = useAuth();

  const [notes, setNotes] =
    useState<VoiceNote[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState('');

  const [recording, setRecording] =
    useState(false);

  const [
    recordingSeconds,
    setRecordingSeconds,
  ] = useState(0);


  const [
    audioUrls,
    setAudioUrls,
  ] =
    useState<
      Record<string, string>
    >({});

  const [
    loadingAudioId,
    setLoadingAudioId,
  ] =
    useState<
      string | null
    >(null);

  const [
    transcriptDrafts,
    setTranscriptDrafts,
  ] =
    useState<
      Record<string, string>
    >({});

  const recorderRef =
    useRef<MediaRecorder | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  const chunksRef =
    useRef<Blob[]>([]);

  const timerRef =
    useRef<
      ReturnType<
        typeof setInterval
      > | null
    >(null);

  const startedAtRef =
    useRef<number | null>(
      null,
    );

  const request =
    useCallback(
      async <T,>(
        path: string,
        init?: RequestInit,
      ): Promise<T> => {
        const response =
          await authFetch(
            path,
            init,
          );

        let data:
          | unknown
          | null = null;

        try {
          data =
            await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              data,
              'Request failed.',
            ),
          );
        }

        return data as T;
      },
      [authFetch],
    );

  const applyNotes = useCallback(
    (
      result: VoiceNote[],
    ) => {
      setNotes(result);

      setTranscriptDrafts(
        (current) => {
          const next = {
            ...current,
          };

          for (
            const note of result
          ) {
            if (
              note.transcriptionStatus ===
                'COMPLETED' ||
              next[
                note.id
              ] === undefined
            ) {
              next[
                note.id
              ] =
                note.transcript ||
                '';
            }
          }

          return next;
        },
      );
    },
    [],
  );

  const loadNotes =
    useCallback(
      async (
        silent = false,
      ) => {
        if (!silent) {
          setLoading(true);
          setError('');
        }

        try {
          const result =
            await request<
              VoiceNote[]
            >(
              `/voice-notes/task/${taskId}`,
            );

          applyNotes(
            result,
          );
        } catch (err) {
          if (!silent) {
            setError(
              err instanceof Error
                ? err.message
                : 'Unable to load voice notes.',
            );
          }
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [
        applyNotes,
        request,
        taskId,
      ],
    );

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const hasActiveTranscription =
    notes.some(
      (note) =>
        note.transcriptionStatus ===
          'PENDING' ||
        note.transcriptionStatus ===
          'PROCESSING',
    );

  useEffect(() => {
    if (
      !hasActiveTranscription
    ) {
      return;
    }

    const interval =
      setInterval(() => {
        void loadNotes(
          true,
        );
      }, 2500);

    return () =>
      clearInterval(
        interval,
      );
  }, [
    hasActiveTranscription,
    loadNotes,
  ]);

  useEffect(() => {
    return () => {
      if (
        timerRef.current
      ) {
        clearInterval(
          timerRef.current,
        );
      }

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );
    };
  }, []);

  useEffect(() => {
    return () => {
      Object.values(
        audioUrls,
      ).forEach(
        (url) =>
          URL.revokeObjectURL(
            url,
          ),
      );
    };
  }, [audioUrls]);

  const finishRecording =
    useCallback(() => {
      const recorder =
        recorderRef.current;

      if (
        recorder &&
        recorder.state !==
          'inactive'
      ) {
        recorder.stop();
      }
    }, []);

  const saveVoiceFile =
    useCallback(
      async (
        file: File,
        duration: number | null,
      ) => {
        setBusy(true);
        setError('');

        try {
          const form =
            new FormData();

          form.append(
            'file',
            file,
          );

          if (
            duration !== null
          ) {
            form.append(
              'durationSeconds',
              String(duration),
            );
          }

          const response =
            await authFetch(
              `/voice-notes/task/${taskId}`,
              {
                method: 'POST',
                body: form,
              },
            );

          let data:
            | unknown
            | null = null;

          try {
            data =
              await response.json();
          } catch {
            data = null;
          }

          if (!response.ok) {
            throw new Error(
              getErrorMessage(
                data,
                'Unable to upload voice note.',
              ),
            );
          }

          await loadNotes();
          onChanged?.();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to upload voice note.',
          );
        } finally {
          setBusy(false);
        }
      },
      [
        authFetch,
        loadNotes,
        onChanged,
        taskId,
      ],
    );

  const startRecording =
    async () => {
      if (!canUpload) {
        return;
      }

      setError('');

      if (
        !navigator.mediaDevices
          ?.getUserMedia ||
        typeof MediaRecorder ===
          'undefined'
      ) {
        setError(
          'Voice recording is not supported in this browser. You can still upload an audio file.',
        );
        return;
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,
            },
          );

        streamRef.current =
          stream;

        chunksRef.current =
          [];

        const mimeType =
          preferredMimeType();

        const recorder =
          mimeType
            ? new MediaRecorder(
                stream,
                {
                  mimeType,
                },
              )
            : new MediaRecorder(
                stream,
              );

        recorderRef.current =
          recorder;

        recorder.ondataavailable =
          (event) => {
            if (
              event.data.size >
              0
            ) {
              chunksRef.current.push(
                event.data,
              );
            }
          };

        recorder.onstop =
          () => {
            if (
              timerRef.current
            ) {
              clearInterval(
                timerRef.current,
              );

              timerRef.current =
                null;
            }

            const duration =
              startedAtRef.current
                ? Math.max(
                    1,
                    Math.round(
                      (
                        Date.now() -
                        startedAtRef.current
                      ) /
                        1000,
                    ),
                  )
                : recordingSeconds;

            const finalMime =
              recorder.mimeType ||
              mimeType ||
              'audio/webm';

            const blob =
              new Blob(
                chunksRef.current,
                {
                  type:
                    finalMime,
                },
              );

            const extension =
              extensionForMime(
                finalMime,
              );

            const file =
              new File(
                [blob],
                `voice-note-${Date.now()}.${extension}`,
                {
                  type:
                    finalMime,
                },
              );

            setRecording(false);

            void saveVoiceFile(
              file,
              duration,
            );

            streamRef.current
              ?.getTracks()
              .forEach(
                (track) =>
                  track.stop(),
              );

            streamRef.current =
              null;

            startedAtRef.current =
              null;
          };

        recorder.onerror =
          () => {
            setError(
              'Recording failed. Please try again.',
            );

            setRecording(false);
          };

        setRecordingSeconds(
          0,
        );
        setRecording(true);

        startedAtRef.current =
          Date.now();

        recorder.start(500);

        timerRef.current =
          setInterval(() => {
            setRecordingSeconds(
              (current) => {
                const next =
                  current + 1;

                if (
                  next >= 600
                ) {
                  setTimeout(
                    () =>
                      finishRecording(),
                    0,
                  );
                }

                return next;
              },
            );
          }, 1000);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Microphone permission was not granted.',
        );

        setRecording(false);

        streamRef.current
          ?.getTracks()
          .forEach(
            (track) =>
              track.stop(),
          );

        streamRef.current =
          null;
      }
    };

  const chooseAudioFile =
    (
      event: ChangeEvent<HTMLInputElement>,
    ) => {
      const file =
        event.target
          .files?.[0] ||
        null;

      event.target.value = '';

      if (!file) {
        return;
      }

      void saveVoiceFile(
        file,
        null,
      );
    };

  const loadAudio =
    async (
      note: VoiceNote,
    ) => {
      if (
        audioUrls[note.id]
      ) {
        return;
      }

      setLoadingAudioId(
        note.id,
      );
      setError('');

      try {
        const response =
          await authFetch(
            `/voice-notes/${note.id}/content`,
          );

        if (!response.ok) {
          let data:
            | unknown
            | null = null;

          try {
            data =
              await response.json();
          } catch {
            data = null;
          }

          throw new Error(
            getErrorMessage(
              data,
              'Unable to load voice note.',
            ),
          );
        }

        const blob =
          await response.blob();

        const url =
          URL.createObjectURL(
            blob,
          );

        setAudioUrls(
          (current) => ({
            ...current,
            [note.id]:
              url,
          }),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load voice note.',
        );
      } finally {
        setLoadingAudioId(
          null,
        );
      }
    };

  const retryTranscription =
    async (
      note: VoiceNote,
    ) => {
      setBusy(true);
      setError('');

      try {
        await request(
          `/voice-notes/${note.id}/transcribe`,
          {
            method: 'POST',
          },
        );

        await loadNotes();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to retry transcription.',
        );
      } finally {
        setBusy(false);
      }
    };

  const saveTranscript =
    async (
      note: VoiceNote,
    ) => {
      const mine =
        user?.id ===
        note.uploadedById;

      if (
        !mine &&
        !canManageFiles
      ) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await request(
          `/voice-notes/${note.id}/transcript`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              transcript:
                transcriptDrafts[
                  note.id
                ] || '',
            }),
          },
        );

        await loadNotes();
        onChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to save transcript.',
        );
      } finally {
        setBusy(false);
      }
    };

  const removeVoiceNote =
    async (
      note: VoiceNote,
    ) => {
      const confirmed =
        await appDialog.confirm({
          title: 'Delete voice note',
          message: 'Delete this voice note?',
          confirmLabel: 'Delete',
          tone: 'danger',
        });

      if (!confirmed) {
        return;
      }

      setBusy(true);
      setError('');

      try {
        await request(
          `/voice-notes/${note.id}`,
          {
            method: 'DELETE',
          },
        );

        const url =
          audioUrls[
            note.id
          ];

        if (url) {
          URL.revokeObjectURL(
            url,
          );

          setAudioUrls(
            (current) => {
              const next = {
                ...current,
              };

              delete next[
                note.id
              ];

              return next;
            },
          );
        }

        await loadNotes();
        onChanged?.();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to delete voice note.',
        );
      } finally {
        setBusy(false);
      }
    };

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading voice notes...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-rose-600" />

          <h4 className="font-bold text-slate-900">
            Voice Notes
          </h4>

          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {notes.length}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {canUpload && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={
              recording
                ? finishRecording
                : () =>
                    void startRecording()
            }
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
              recording
                ? 'bg-red-600 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            {recording ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {recording
              ? `Stop ${formatDuration(
                  recordingSeconds,
                )}`
              : 'Record Voice'}
          </button>

          <label
            className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 ${
              busy
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Audio
            <input
              id={`voice-file-${taskId}`}
              type="file"
              accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a,.mp4,.aac"
              onChange={
                chooseAudioFile
              }
              disabled={busy}
              className="hidden"
            />
          </label>

          {busy && !recording && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}
        </div>
      )}

      <div className="mt-2 space-y-2">
        {!notes.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-400">
            No voice notes yet.
          </div>
        ) : (
          notes.map(
            (note) => {
              const mine =
                user?.id ===
                note.uploadedById;

              const canEdit =
                canUpload &&
                (mine ||
                  canManageFiles);

              const active =
                note.transcriptionStatus ===
                  'PENDING' ||
                note.transcriptionStatus ===
                  'PROCESSING';

              return (
                <article
                  key={note.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                        <FileAudio className="h-4 w-4 text-rose-600" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {note.originalName ||
                            'Voice note'}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatDuration(
                            note.durationSeconds,
                          )}{' '}
                          ·{' '}
                          {formatBytes(
                            note.sizeBytes,
                          )}{' '}
                          ·{' '}
                          {dateTime(
                            note.createdAt,
                          )}
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-500">
                          Added by{' '}
                          {displayName(
                            note.uploadedBy,
                          )}
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          void removeVoiceNote(
                            note,
                          )
                        }
                        disabled={busy}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        title="Delete voice note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2">
                    {audioUrls[
                      note.id
                    ] ? (
                      <audio
                        src={
                          audioUrls[
                            note.id
                          ]
                        }
                        controls
                        preload="metadata"
                        className="h-8 w-full"
                      />
                    ) : canDownload ? (
                      <button
                        type="button"
                        onClick={() =>
                          void loadAudio(
                            note,
                          )
                        }
                        disabled={
                          loadingAudioId ===
                          note.id
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        {loadingAudioId ===
                        note.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}

                        Load Audio
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2 rounded-lg bg-white p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Transcript
                        </p>

                        {note.language && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Detected language: {note.language}
                          </p>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          note.transcriptionStatus ===
                          'FAILED'
                            ? 'bg-red-50 text-red-700'
                            : active
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {active && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}

                        {statusLabel(
                          note,
                        )}
                      </span>
                    </div>

                    {note.transcriptionStatus ===
                      'FAILED' && (
                      <div className="mt-3 rounded-xl bg-red-50 p-3">
                        <p className="text-xs text-red-700">
                          {note.errorMessage ||
                            'Local transcription failed.'}
                        </p>

                        {canUpload && (
                          <button
                            type="button"
                            onClick={() =>
                              void retryTranscription(
                                note,
                              )
                            }
                            disabled={busy}
                            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-red-700 shadow-sm disabled:opacity-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry Transcription
                          </button>
                        )}
                      </div>
                    )}

                    {active ? (
                      <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Transcribing…
                      </div>
                    ) : canEdit ? (
                      <>
                        <textarea
                          value={
                            transcriptDrafts[
                              note.id
                            ] || ''
                          }
                          onChange={(event) =>
                            setTranscriptDrafts(
                              (
                                current,
                              ) => ({
                                ...current,
                                [note.id]:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                          }
                          rows={1}
                          maxLength={20000}
                          placeholder="Automatic transcript will appear here. You can correct it manually."
                          className="mt-2 max-h-28 min-h-9 w-full resize-none overflow-y-auto rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-violet-400"
                        />

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void saveTranscript(
                                note,
                              )
                            }
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save Correction
                          </button>

                          {canUpload && (
                            <button
                              type="button"
                              onClick={() =>
                                void retryTranscription(
                                  note,
                                )
                              }
                              disabled={busy}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Run Local AI Again
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {note.transcript ||
                          'No transcript available.'}
                      </p>
                    )}
                  </div>
                </article>
              );
            },
          )
        )}
      </div>
    </section>
  );
}
