'use client';

import {
  ChangeEvent,
  FormEvent,
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
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

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
    pendingFile,
    setPendingFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    pendingDuration,
    setPendingDuration,
  ] =
    useState<
      number | null
    >(null);

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

            setPendingFile(
              file,
            );

            setPendingDuration(
              duration,
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

        setPendingFile(null);
        setPendingDuration(
          null,
        );
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

      setPendingFile(file);
      setPendingDuration(
        null,
      );
    };

  const uploadVoiceNote =
    async (
      event: FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (!pendingFile) {
        setError(
          'Record or choose an audio file first.',
        );
        return;
      }

      setBusy(true);
      setError('');

      try {
        const form =
          new FormData();

        form.append(
          'file',
          pendingFile,
        );

        if (
          pendingDuration !==
          null
        ) {
          form.append(
            'durationSeconds',
            String(
              pendingDuration,
            ),
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

        setPendingFile(
          null,
        );
        setPendingDuration(
          null,
        );
        setRecordingSeconds(
          0,
        );

        const input =
          document.getElementById(
            `voice-file-${taskId}`,
          ) as HTMLInputElement | null;

        if (input) {
          input.value = '';
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
      if (
        !window.confirm(
          'Delete this voice note?',
        )
      ) {
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading voice notes...
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-rose-600" />

            <h4 className="font-bold text-slate-900">
              Voice Notes
            </h4>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {notes.length}
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Record task instructions, feedback or work updates. Local Whisper creates the transcript automatically.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          Local AI · No paid API
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {canUpload && (
        <form
          onSubmit={
            uploadVoiceNote
          }
          className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
        >
          <div className="flex flex-wrap gap-2">
            {!recording ? (
              <button
                type="button"
                onClick={() =>
                  void startRecording()
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Mic className="h-4 w-4" />
                Record Voice Note
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  finishRecording
                }
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
              >
                <Square className="h-4 w-4" />
                Stop {formatDuration(
                  recordingSeconds,
                )}
              </button>
            )}

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
              <Upload className="h-4 w-4" />
              Upload Audio

              <input
                id={`voice-file-${taskId}`}
                type="file"
                accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a,.mp4,.aac"
                onChange={
                  chooseAudioFile
                }
                className="hidden"
              />
            </label>
          </div>

          {pendingFile && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {pendingFile.name}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {formatBytes(
                    pendingFile.size,
                  )}

                  {pendingDuration !==
                  null
                    ? ` · ${formatDuration(
                        pendingDuration,
                      )}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPendingFile(
                    null,
                  );

                  setPendingDuration(
                    null,
                  );
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                title="Remove selected recording"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Maximum 10 minutes / 20 MB. After saving, transcription runs locally on this machine.
          </p>

          <button
            type="submit"
            disabled={
              busy ||
              recording ||
              !pendingFile
            }
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}

            Save Voice Note
          </button>
        </form>
      )}

      <div className="mt-5 space-y-3">
        {!notes.length ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
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
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                        <FileAudio className="h-5 w-5 text-rose-600" />
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

                  <div className="mt-4">
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
                        className="w-full"
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
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
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

                  <div className="mt-4 rounded-xl bg-white p-3">
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
                          rows={4}
                          maxLength={20000}
                          placeholder="Automatic transcript will appear here. You can correct it manually."
                          className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
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
