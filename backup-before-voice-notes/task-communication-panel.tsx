'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Download,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Film,
  Loader2,
  MessageSquare,
  Paperclip,
  Reply,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

type FilePurpose = 'GENERAL' | 'REFERENCE' | 'WORK_SUBMISSION';

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

interface TaskComment {
  id: string;
  authorId: string;
  parentId?: string | null;
  content: string;
  editedAt?: string | null;
  createdAt: string;
  author: UserSummary;
  mentions?: {
    id: string;
    mentionedUser: UserSummary;
  }[];
}

interface TaskFile {
  id: string;
  originalName: string;
  mimeType: string;
  extension?: string | null;
  sizeBytes: number;
  uploadedById: string;
  purpose: FilePurpose;
  createdAt: string;
  uploadedBy: UserSummary;
}

interface Props {
  taskId: string;
  canComment: boolean;
  canManageComments: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canManageFiles: boolean;
  onChanged?: () => void;
}

function errorMessage(value: unknown, fallback: string) {
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const message = (value as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function nameOf(user?: UserSummary | null) {
  if (!user) return 'Team member';
  const profile = user.employeeProfile;
  if (profile?.fullName) {
    return profile.username
      ? `${profile.fullName} (@${profile.username})`
      : profile.fullName;
  }
  return user.email || user.phone || 'Team member';
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function purposeName(value: FilePurpose) {
  if (value === 'REFERENCE') return 'Reference';
  if (value === 'WORK_SUBMISSION') return 'Work Submission';
  return 'General';
}

function iconFor(file: TaskFile) {
  const ext = (file.extension || file.originalName.split('.').pop() || '').toLowerCase();
  if (file.mimeType.startsWith('image/')) return FileImage;
  if (file.mimeType.startsWith('video/')) return Film;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (ext === 'zip') return FileArchive;
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt'].includes(ext)) return FileText;
  return File;
}

function previewable(file: TaskFile) {
  return (
    file.mimeType.startsWith('image/') ||
    file.mimeType === 'application/pdf' ||
    file.mimeType.startsWith('video/')
  );
}

export function TaskCommunicationPanel({
  taskId,
  canComment,
  canManageComments,
  canUpload,
  canDownload,
  canManageFiles,
  onChanged,
}: Props) {
  const { authFetch, user } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null);
  const [upload, setUpload] = useState<File | null>(null);
  const [purpose, setPurpose] = useState<FilePurpose>('GENERAL');
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    mimeType: string;
  } | null>(null);

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await authFetch(path, init);
      let data: unknown = null;
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(errorMessage(data, 'Request failed.'));
      return data as T;
    },
    [authFetch],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [commentData, fileData] = await Promise.all([
        request<TaskComment[]>(`/comments/task/${taskId}`),
        request<TaskFile[]>(`/files/task/${taskId}`),
      ]);
      setComments(commentData);
      setFiles(fileData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load task work area.');
    } finally {
      setLoading(false);
    }
  }, [request, taskId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const grouped = useMemo(() => {
    const roots = comments.filter((item) => !item.parentId);
    const replies = new Map<string, TaskComment[]>();
    comments.forEach((item) => {
      if (!item.parentId) return;
      replies.set(item.parentId, [...(replies.get(item.parentId) || []), item]);
    });
    return { roots, replies };
  }, [comments]);

  const history = useMemo(() => [
    ...comments.map((item) => ({
      id: `c-${item.id}`,
      at: item.createdAt,
      kind: 'comment',
      text: `${nameOf(item.author)} ${item.parentId ? 'replied' : 'commented'}: ${item.content}`,
    })),
    ...files.map((item) => ({
      id: `f-${item.id}`,
      at: item.createdAt,
      kind: 'file',
      text: `${nameOf(item.uploadedBy)} uploaded ${item.originalName} (${purposeName(item.purpose)})`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [comments, files]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await request(`/comments/task/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim(), parentId: replyTo?.id || undefined }),
      });
      setText('');
      setReplyTo(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add comment.');
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(comment: TaskComment) {
    if (!window.confirm('Delete this comment?')) return;
    setError('');
    try {
      await request(`/comments/${comment.id}`, { method: 'DELETE' });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete comment.');
    }
  }

  async function submitFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!upload) {
      setError('Please choose a file.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', upload);
      form.append('purpose', purpose);
      const response = await authFetch(`/files/task/${taskId}`, {
        method: 'POST',
        body: form,
      });
      let data: unknown = null;
      try { data = await response.json(); } catch {}
      if (!response.ok) throw new Error(errorMessage(data, 'Unable to upload file.'));
      setUpload(null);
      setPurpose('GENERAL');
      const input = document.getElementById(`task-file-${taskId}`) as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload file.');
    } finally {
      setBusy(false);
    }
  }

  async function fileBlob(file: TaskFile, download = false) {
    const response = await authFetch(
      `/files/${file.id}/content${download ? '?download=1' : ''}`,
    );
    if (!response.ok) throw new Error('Unable to open file.');
    return response.blob();
  }

  async function openFile(file: TaskFile) {
    setError('');
    try {
      const blob = await fileBlob(file);
      if (preview?.url) URL.revokeObjectURL(preview.url);
      setPreview({
        url: URL.createObjectURL(blob),
        name: file.originalName,
        mimeType: file.mimeType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview file.');
    }
  }

  async function downloadFile(file: TaskFile) {
    setError('');
    try {
      const blob = await fileBlob(file, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download file.');
    }
  }

  async function removeFile(file: TaskFile) {
    if (!window.confirm(`Delete "${file.originalName}"?`)) return;
    setError('');
    try {
      await request(`/files/${file.id}`, { method: 'DELETE' });
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete file.');
    }
  }

  function commentCard(comment: TaskComment, reply = false) {
    const mine = user?.id === comment.authorId;
    return (
      <div key={comment.id} className={reply ? 'ml-6 border-l-2 border-slate-100 pl-4' : ''}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">{nameOf(comment.author)}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {dateTime(comment.createdAt)}{comment.editedAt ? ' · edited' : ''}
              </p>
            </div>
            <div className="flex gap-1">
              {canComment && (
                <button type="button" onClick={() => setReplyTo(comment)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Reply">
                  <Reply className="h-4 w-4" />
                </button>
              )}
              {canComment && (mine || canManageComments) && (
                <button type="button" onClick={() => void removeComment(comment)} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Delete comment">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{comment.content}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-7 flex items-center justify-center rounded-2xl border border-slate-200 p-8 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading task work area...
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6 border-t border-slate-200 pt-7">
      <div>
        <h3 className="text-lg font-bold text-slate-950">Task Work Area</h3>
        <p className="mt-1 text-sm text-slate-500">Comments, replies, references and completed work stay with this task.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-violet-600" /><h4 className="font-bold">Discussion</h4></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">{comments.length}</span>
          </div>

          {canComment && (
            <form onSubmit={submitComment} className="mt-4">
              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  <span>Replying to {nameOf(replyTo.author)}</span>
                  <button type="button" onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button>
                </div>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={5000}
                placeholder="Add a work update. Use @username to mention someone."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-violet-400"
              />
              <div className="mt-2 flex justify-end">
                <button type="submit" disabled={busy || !text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {replyTo ? 'Send Reply' : 'Add Comment'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 max-h-[430px] space-y-3 overflow-y-auto pr-1">
            {!comments.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">No comments yet.</div>
            ) : grouped.roots.map((comment) => (
              <div key={comment.id} className="space-y-3">
                {commentCard(comment)}
                {(grouped.replies.get(comment.id) || []).map((item) => commentCard(item, true))}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Paperclip className="h-5 w-5 text-blue-600" /><h4 className="font-bold">Files & Work</h4></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">{files.length}</span>
          </div>

          {canUpload && (
            <form onSubmit={submitFile} className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4">
              <select value={purpose} onChange={(e) => setPurpose(e.target.value as FilePurpose)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="GENERAL">General File</option>
                <option value="REFERENCE">Reference / Brief</option>
                <option value="WORK_SUBMISSION">Completed Work / Submission</option>
              </select>
              <input
                id={`task-file-${taskId}`}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.mp4,.webm,.mov"
                onChange={(e) => setUpload(e.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
              />
              <p className="mt-2 text-xs text-slate-400">Max 50 MB.</p>
              <button type="submit" disabled={busy || !upload} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload File
              </button>
            </form>
          )}

          <div className="mt-5 max-h-[430px] space-y-3 overflow-y-auto pr-1">
            {!files.length ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">No files uploaded yet.</div>
            ) : files.map((file) => {
              const Icon = iconFor(file);
              const mine = user?.id === file.uploadedById;
              return (
                <div key={file.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-5 w-5 text-slate-600" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold" title={file.originalName}>{file.originalName}</p>
                      <p className="mt-1 text-xs text-slate-400">{bytes(file.sizeBytes)} · {dateTime(file.createdAt)}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">Uploaded by {nameOf(file.uploadedBy)}</p>
                      <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${file.purpose === 'WORK_SUBMISSION' ? 'bg-emerald-50 text-emerald-700' : file.purpose === 'REFERENCE' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{purposeName(file.purpose)}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canDownload && previewable(file) && (
                      <button type="button" onClick={() => void openFile(file)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Eye className="h-3.5 w-3.5" /> Preview</button>
                    )}
                    {canDownload && (
                      <button type="button" onClick={() => void downloadFile(file)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><Download className="h-3.5 w-3.5" /> Download</button>
                    )}
                    {canUpload && (mine || canManageFiles) && (
                      <button type="button" onClick={() => void removeFile(file)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h4 className="font-bold text-slate-900">Communication History</h4>
        <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">
          {!history.length ? <p className="text-sm text-slate-400">No communication activity yet.</p> : history.map((item) => (
            <div key={item.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0">
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.kind === 'file' ? 'bg-blue-500' : 'bg-violet-500'}`} />
              <div><p className="break-words text-xs text-slate-600">{item.text}</p><p className="mt-1 text-[11px] text-slate-400">{dateTime(item.at)}</p></div>
            </div>
          ))}
        </div>
      </section>

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="truncate pr-4 text-sm font-bold">{preview.name}</p>
              <button type="button" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex min-h-[50vh] max-h-[80vh] items-center justify-center overflow-auto bg-slate-100 p-4">
              {preview.mimeType.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name} className="max-h-[74vh] max-w-full object-contain" />
              ) : preview.mimeType === 'application/pdf' ? (
                <iframe src={preview.url} title={preview.name} className="h-[74vh] w-full rounded-lg bg-white" />
              ) : preview.mimeType.startsWith('video/') ? (
                <video src={preview.url} controls className="max-h-[74vh] max-w-full" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
