'use client';

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Edit3,
  Eye,
  ListPlus,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Square,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useAuth } from '@/components/auth/auth-provider';

type ProjectStatus =
  | 'PLANNING'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

type ProjectReviewStage =
  | 'CLIENT_SERVICING_REVIEW'
  | 'CLIENT_REVIEW'
  | 'CHANGES_REQUIRED'
  | 'COMPLETED';

type Priority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

type MilestoneStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED';

interface Client {
  id: string;
  name: string;
  companyName: string | null;
  requirements?: string | null;
}

interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  designation: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface ProjectMember {
  id: string;
  employeeId: string;
  memberRole: string | null;
  isActive: boolean;

  employee: Employee;
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  status: MilestoneStatus;
  sortOrder: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;

  clientId: string;
  projectManagerId: string | null;
  departmentId: string | null;

  startDate: string | null;
  deadline: string | null;

  priority: Priority;
  status: ProjectStatus;
  reviewStage: ProjectReviewStage | null;
  clientReviewSentAt?: string | null;
  clientApprovedAt?: string | null;
  clientFeedback?: string | null;
  clientFeedbackAt?: string | null;
  clientFeedbackDepartmentIds?: string[];

  estimatedHours:
    | string
    | number
    | null;

  budget:
    | string
    | number
    | null;

  internalNotes: string | null;

  createdAt: string;

  client: Client;

  projectManager: Employee | null;
  department: Department | null;
  departments?: Department[];
  voiceTranscript?: string | null;
  voiceLanguage?: string | null;

  members: ProjectMember[];
  milestones: Milestone[];

  taskCount: number;
  progress: number;
}

interface ProjectsResponse {
  data: Project[];

  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ClientsResponse {
  data: Client[];
}

interface ClientWorkflowAccess {
  canClientServicing: boolean;
  canManageAll: boolean;
  managedDepartments?: Department[];
}

interface ClientServicingDashboardResponse {
  recentHandovers: Array<{
    id: string;
    name: string;
    companyName: string | null;
    requirements: string | null;
  }>;
}

type ModalType =
  | 'create'
  | 'view'
  | 'edit'
  | 'members'
  | 'milestones'
  | null;

function getErrorMessage(
  data: unknown,
  fallback: string,
) {
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data
  ) {
    const message = (
      data as {
        message?: string | string[];
      }
    ).message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (
      typeof message === 'string'
    ) {
      return message;
    }
  }

  return fallback;
}

function normalizeDepartmentName(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function isWorkflowDepartmentName(value?: string | null) {
  return [
    'hr',
    'humanresources',
    'businessdevelopment',
    'businessdevelopmentmanager',
    'businessdevelopmentdepartment',
    'bdm',
    'bd',
    'accounts',
    'account',
    'accountsquotation',
    'accountsandquotation',
    'accountsfinance',
    'accountsandfinance',
    'finance',
    'clientservicing',
    'clientservice',
    'clientservicingdepartment',
    'clientrelations',
    'clientrelationship',
  ].includes(
    normalizeDepartmentName(value),
  );
}

export default function ProjectsPage() {
  const {
    authFetch,
    hasPermission,
  } = useAuth();

  const searchParams =
    useSearchParams();

  const [
    projects,
    setProjects,
  ] = useState<Project[]>([]);

  const [clients, setClients] =
    useState<Client[]>([]);

  const [
    employees,
    setEmployees,
  ] = useState<Employee[]>([]);

  const [
    departments,
    setDepartments,
  ] = useState<Department[]>([]);

  const [
    workflowAccess,
    setWorkflowAccess,
  ] = useState<ClientWorkflowAccess | null>(null);

  const queryCreateHandledRef =
    useRef(false);

  const [search, setSearch] =
    useState('');

  const [status, setStatus] =
    useState('');

  const [priority, setPriority] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState('');

  const [modal, setModal] =
    useState<ModalType>(null);

  const [
    selectedProject,
    setSelectedProject,
  ] = useState<Project | null>(
    null,
  );

  const canUploadFiles =
    hasPermission(
      'files.upload',
    );

  const clientServicingMode =
    Boolean(
      workflowAccess?.canClientServicing &&
        !workflowAccess?.canManageAll,
    );

  const canFullProjectManage =
    Boolean(
      workflowAccess?.canManageAll ||
        workflowAccess?.canClientServicing,
    );

  const canCreateProject =
    canFullProjectManage;

  const managedDepartmentIds = new Set(
    (workflowAccess?.managedDepartments ?? [])
      .filter((department) => !isWorkflowDepartmentName(department.name))
      .map((department) => department.id),
  );

  const canCreateTaskForProject = (project: Project) => {
    const projectDepartmentIds = project.departments?.length
      ? project.departments.map((department) => department.id)
      : project.department?.id
        ? [project.department.id]
        : project.departmentId
          ? [project.departmentId]
          : [];

    return projectDepartmentIds.some((departmentId) =>
      managedDepartmentIds.has(departmentId),
    );
  };

  const displayedProjects =
    !canFullProjectManage && managedDepartmentIds.size
      ? projects.filter((project) => canCreateTaskForProject(project))
      : projects;

  const request = useCallback(
    async <T,>(
      path: string,
      options?: RequestInit,
    ): Promise<T> => {
      const response =
        await authFetch(
          path,
          options,
        );

      let data: unknown = null;

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

  const loadProjects =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const params =
          new URLSearchParams();

        params.set(
          'limit',
          '100',
        );

        params.set(
          'sortBy',
          'createdAt',
        );

        params.set(
          'sortOrder',
          'desc',
        );

        if (search.trim()) {
          params.set(
            'search',
            search.trim(),
          );
        }

        if (status) {
          params.set(
            'status',
            status,
          );
        }

        if (priority) {
          params.set(
            'priority',
            priority,
          );
        }

        const result =
          await request<ProjectsResponse>(
            `/projects?${params.toString()}`,
          );

        setProjects(
          result.data,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load projects.',
        );
      } finally {
        setLoading(false);
      }
    }, [
      request,
      search,
      status,
      priority,
    ]);

  const loadOptions =
    useCallback(async () => {
      try {
        const access =
          await request<ClientWorkflowAccess>(
            '/clients/workflow-access',
          );

        setWorkflowAccess(
          access,
        );

        const [
          clientOptionsResponse,
          employeesResponse,
          departmentsResponse,
        ] = await Promise.all([
          access.canClientServicing &&
          !access.canManageAll
            ? request<ClientServicingDashboardResponse>(
                '/clients/client-servicing-dashboard',
              )
            : request<ClientsResponse>(
                '/clients?limit=100',
              ),

          request<any[]>(
            '/employees',
          ),

          request<any[]>(
            '/departments',
          ),
        ]);

        const clientOptions =
          'recentHandovers' in
          clientOptionsResponse
            ? clientOptionsResponse.recentHandovers
            : clientOptionsResponse.data;

        setClients(
          clientOptions.map(
            (client) => ({
              id: client.id,
              name: client.name,
              companyName:
                client.companyName,
              requirements:
                client.requirements ??
                null,
            }),
          ),
        );

        setEmployees(
          employeesResponse.map(
            (employee) => ({
              id: employee.id,
              employeeId:
                employee.employeeId,
              fullName:
                employee.fullName,
              designation:
                employee.designation,
            }),
          ),
        );

        const mappedDepartments =
          departmentsResponse.map(
            (department) => ({
              id: department.id,
              name: department.name,
            }),
          );

        setDepartments(
          access.canClientServicing &&
          !access.canManageAll
            ? mappedDepartments.filter(
                (department) =>
                  !isWorkflowDepartmentName(
                    department.name,
                  ),
              )
            : mappedDepartments,
        );
      } catch {
        // Main projects page can still load
        // even if one dropdown API fails.
      }
    }, [request]);

  useEffect(() => {
    const timer =
      setTimeout(() => {
        void loadProjects();
      }, 250);

    return () =>
      clearTimeout(timer);
  }, [loadProjects]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (
      queryCreateHandledRef.current ||
      searchParams.get('new') !== '1' ||
      !canCreateProject
    ) {
      return;
    }

    const requestedClientId =
      searchParams.get('clientId');

    if (
      requestedClientId &&
      !clients.some(
        (client) =>
          client.id === requestedClientId,
      )
    ) {
      return;
    }

    queryCreateHandledRef.current = true;
    setSelectedProject(null);
    setModal('create');
  }, [canCreateProject, clients, searchParams]);

  const refreshSelected =
    async (projectId: string) => {
      const fresh =
        await request<Project>(
          `/projects/${projectId}`,
        );

      setSelectedProject(fresh);

      await loadProjects();
    };

  const closeModal = () => {
    setModal(null);
    setSelectedProject(null);
    setError('');
  };

  const uploadProjectAssets =
    useCallback(
      async (
        projectId: string,
        attachments: File[],
        voiceNote: File | null,
      ) => {
        const files = [
          ...attachments,
          ...(voiceNote
            ? [voiceNote]
            : []),
        ];

        for (const file of files) {
          const uploadForm =
            new FormData();

          uploadForm.append(
            'file',
            file,
          );

          uploadForm.append(
            'purpose',
            'REFERENCE',
          );

          const response =
            await authFetch(
              `/files/project/${projectId}`,
              {
                method: 'POST',
                body: uploadForm,
              },
            );

          if (!response.ok) {
            let uploadError:
              unknown = null;

            try {
              uploadError =
                await response.json();
            } catch {}

            throw new Error(
              getErrorMessage(
                uploadError,
                `Project saved, but "${file.name}" could not be uploaded.`,
              ),
            );
          }
        }
      },
      [authFetch],
    );

  const createProject = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    const clientId =
      String(
        form.get('clientId') ??
          '',
      ).trim();

    if (!clientId) {
      setError(
        'Please select an existing client from the suggestions.',
      );
      return;
    }

    const departmentIds =
      form
        .getAll(
          'departmentIds',
        )
        .map(String)
        .filter(Boolean);

    const attachments =
      form
        .getAll('attachments')
        .filter(
          (
            value,
          ): value is File =>
            value instanceof File &&
            value.size > 0,
        );

    const voiceValue =
      form.get('voiceNote');

    const voiceNote =
      voiceValue instanceof
        File &&
      voiceValue.size > 0
        ? voiceValue
        : null;

    setSaving(true);
    setError('');

    try {
      const project =
        await request<Project>(
          '/projects',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              name: String(
                form.get(
                  'name',
                ) ?? '',
              ),

              clientId,

              departmentIds,

              deadline:
                String(
                  form.get(
                    'deadline',
                  ) ?? '',
                ) ||
                undefined,

              priority:
                String(
                  form.get(
                    'priority',
                  ) ??
                    'MEDIUM',
                ),

              description:
                String(
                  form.get(
                    'brief',
                  ) ?? '',
                ) ||
                undefined,

              internalNotes:
                String(
                  form.get(
                    'internalNotes',
                  ) ?? '',
                ) ||
                undefined,

              voiceTranscript:
                String(
                  form.get(
                    'voiceTranscript',
                  ) ?? '',
                ) ||
                undefined,

              voiceLanguage:
                String(
                  form.get(
                    'voiceTranscriptLanguage',
                  ) ?? '',
                ) ||
                undefined,
            }),
          },
        );

      if (
        canUploadFiles &&
        (attachments.length ||
          voiceNote)
      ) {
        await uploadProjectAssets(
          project.id,
          attachments,
          voiceNote,
        );
      }

      closeModal();

      await loadProjects();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Project creation failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const runProjectReviewAction = async (
    project: Project,
    action: 'send-to-client' | 'client-approved',
  ) => {
    setSaving(true);
    setError('');

    try {
      const updated = await request<Project>(
        `/projects/${project.id}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      setSelectedProject(updated);
      await loadProjects();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Project review action failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const requestClientChanges = async (
    project: Project,
    note: string,
    departmentIds: string[],
  ) => {
    setSaving(true);
    setError('');

    try {
      const updated = await request<Project>(
        `/projects/${project.id}/client-changes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note, departmentIds }),
        },
      );

      setSelectedProject(updated);
      await loadProjects();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send client changes.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateProject = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedProject) {
      return;
    }

    const form =
      new FormData(
        event.currentTarget,
      );

    const clientId =
      String(
        form.get('clientId') ??
          '',
      ).trim();

    if (!clientId) {
      setError(
        'Please select an existing client from the suggestions.',
      );
      return;
    }

    const departmentIds =
      form
        .getAll(
          'departmentIds',
        )
        .map(String)
        .filter(Boolean);

    const attachments =
      form
        .getAll('attachments')
        .filter(
          (
            value,
          ): value is File =>
            value instanceof File &&
            value.size > 0,
        );

    const voiceValue =
      form.get('voiceNote');

    const voiceNote =
      voiceValue instanceof
        File &&
      voiceValue.size > 0
        ? voiceValue
        : null;

    setSaving(true);
    setError('');

    try {
      const project =
        await request<Project>(
          `/projects/${selectedProject.id}`,
          {
            method: 'PATCH',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              name: String(
                form.get(
                  'name',
                ) ?? '',
              ),

              clientId,

              departmentIds,

              deadline:
                String(
                  form.get(
                    'deadline',
                  ) ?? '',
                ),

              priority:
                String(
                  form.get(
                    'priority',
                  ) ??
                    'MEDIUM',
                ),

              description:
                String(
                  form.get(
                    'brief',
                  ) ?? '',
                ),

              internalNotes:
                String(
                  form.get(
                    'internalNotes',
                  ) ?? '',
                ),

              voiceTranscript:
                String(
                  form.get(
                    'voiceTranscript',
                  ) ?? '',
                ),

              voiceLanguage:
                String(
                  form.get(
                    'voiceTranscriptLanguage',
                  ) ?? '',
                ),
            }),
          },
        );

      if (
        canUploadFiles &&
        (attachments.length ||
          voiceNote)
      ) {
        await uploadProjectAssets(
          project.id,
          attachments,
          voiceNote,
        );
      }

      closeModal();

      await loadProjects();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Project update failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (
    project: Project,
  ) => {
    const confirmed =
      window.confirm(
        `Delete/archive "${project.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `/projects/${project.id}`,
        {
          method: 'DELETE',
        },
      );

      await loadProjects();
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'Project deletion failed.',
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
            Projects
          </h1>

        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void loadProjects()
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <RefreshCcw className="h-4 w-4" />

            Refresh
          </button>

          {canCreateProject && (
            <button
              type="button"
              onClick={() =>
                setModal('create')
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />

              Add Project
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search projects..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">
              All Statuses
            </option>

            <option value="PLANNING">
              Planning
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="ON_HOLD">
              On Hold
            </option>

            <option value="UNDER_REVIEW">
              Under Review
            </option>

            <option value="COMPLETED">
              Completed
            </option>

            <option value="CANCELLED">
              Cancelled
            </option>

            <option value="ARCHIVED">
              Archived
            </option>
          </select>

          <select
            value={priority}
            onChange={(event) =>
              setPriority(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">
              All Priorities
            </option>

            <option value="LOW">
              Low
            </option>

            <option value="MEDIUM">
              Medium
            </option>

            <option value="HIGH">
              High
            </option>

            <option value="URGENT">
              Urgent
            </option>
          </select>
        </div>

        {error && !modal && (
          <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <ProjectsTable
            projects={displayedProjects}
            canFullManage={canFullProjectManage}
            managedDepartmentIds={Array.from(managedDepartmentIds)}
            onView={(project) => {
              setSelectedProject(project);
              setModal('view');
            }}
            onEdit={(project) => {
              setSelectedProject(
                project,
              );

              setModal('edit');
            }}
            onMembers={(
              project,
            ) => {
              setSelectedProject(
                project,
              );

              setModal('members');
            }}
            onMilestones={(
              project,
            ) => {
              setSelectedProject(
                project,
              );

              setModal(
                'milestones',
              );
            }}
            onDelete={deleteProject}
          />
        )}
      </div>

      {modal === 'create' && (
        <ModalBox
          title="Create Project"
          error={error}
          onClose={closeModal}
        >
          <ProjectForm
            clients={clients}
            clientServicingMode={
              clientServicingMode
            }
            departments={
              departments
            }
            canUploadFiles={
              canUploadFiles
            }
            saving={saving}
            onSubmit={
              createProject
            }
          />
        </ModalBox>
      )}

      {modal === 'view' &&
        selectedProject && (
          <ModalBox
            title={selectedProject.name}
            error={error}
            onClose={closeModal}
          >
            <ProjectHodView
              project={selectedProject}
              showCreateTask={canCreateTaskForProject(selectedProject)}
              taskDepartmentId={(() => {
                const projectDepartmentIds = selectedProject.departments?.length
                  ? selectedProject.departments.map((department) => department.id)
                  : selectedProject.department?.id
                    ? [selectedProject.department.id]
                    : selectedProject.departmentId
                      ? [selectedProject.departmentId]
                      : [];
                const matches = projectDepartmentIds.filter((departmentId) =>
                  managedDepartmentIds.has(departmentId),
                );
                return matches.length === 1 ? matches[0] : '';
              })()}
              clientServicingMode={clientServicingMode}
              saving={saving}
              onSendToClient={(project) =>
                runProjectReviewAction(project, 'send-to-client')
              }
              onClientApproved={(project) =>
                runProjectReviewAction(project, 'client-approved')
              }
              onClientChanges={requestClientChanges}
            />
          </ModalBox>
        )}

      {modal === 'edit' &&
        selectedProject && (
          <ModalBox
            title="Edit Project"
            error={error}
            onClose={closeModal}
          >
            <ProjectForm
              project={
                selectedProject
              }
              clients={clients}
              clientServicingMode={
                clientServicingMode
              }
              departments={
                departments
              }
              canUploadFiles={
                canUploadFiles
              }
              saving={saving}
              onSubmit={
                updateProject
              }
            />
          </ModalBox>
        )}

      {modal === 'members' &&
        selectedProject && (
          <ModalBox
            title={`${selectedProject.name} — Team Members`}
            error={error}
            onClose={closeModal}
          >
            <MembersManager
              project={
                selectedProject
              }
              employees={
                employees
              }
              request={request}
              onChanged={() =>
                refreshSelected(
                  selectedProject.id,
                )
              }
            />
          </ModalBox>
        )}

      {modal === 'milestones' &&
        selectedProject && (
          <ModalBox
            title={`${selectedProject.name} — Milestones`}
            error={error}
            onClose={closeModal}
          >
            <MilestonesManager
              project={
                selectedProject
              }
              request={request}
              onChanged={() =>
                refreshSelected(
                  selectedProject.id,
                )
              }
            />
          </ModalBox>
        )}
    </div>
  );
}

function ProjectsTable({
  projects,
  canFullManage,
  managedDepartmentIds,
  onView,
  onEdit,
  onMembers,
  onMilestones,
  onDelete,
}: {
  projects: Project[];
  canFullManage: boolean;
  managedDepartmentIds: string[];
  onView: (project: Project) => void;
  onEdit: (project: Project) => void;
  onMembers: (project: Project) => void;
  onMilestones: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  if (!projects.length) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        No projects found.
      </div>
    );
  }

  const managedDepartmentIdSet = new Set(managedDepartmentIds);

  const canCreateTaskForRow = (project: Project) => {
    const projectDepartmentIds = project.departments?.length
      ? project.departments.map((department) => department.id)
      : project.department?.id
        ? [project.department.id]
        : project.departmentId
          ? [project.departmentId]
          : [];

    return projectDepartmentIds.some((departmentId) =>
      managedDepartmentIdSet.has(departmentId),
    );
  };

  const taskDepartmentIdForRow = (project: Project) => {
    const projectDepartmentIds = project.departments?.length
      ? project.departments.map((department) => department.id)
      : project.department?.id
        ? [project.department.id]
        : project.departmentId
          ? [project.departmentId]
          : [];

    const matches = projectDepartmentIds.filter((departmentId) =>
      managedDepartmentIdSet.has(departmentId),
    );

    return matches.length === 1 ? matches[0] : '';
  };

  const showActions =
    canFullManage ||
    projects.some((project) => canCreateTaskForRow(project));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-4">Project</th>
            <th className="px-5 py-4">Client</th>
            <th className="px-5 py-4">Manager</th>
            <th className="px-5 py-4">Deadline</th>
            <th className="px-5 py-4">Progress</th>
            <th className="px-5 py-4">Priority</th>
            <th className="px-5 py-4">Status</th>
            {showActions && (
              <th className="px-5 py-4">Actions</th>
            )}
          </tr>
        </thead>

        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="border-t border-slate-100 align-top"
            >
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-900">
                  {project.name}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {(project.departments?.length
                    ? project.departments
                        .map((department) => department.name)
                        .join(', ')
                    : project.department?.name) ?? 'No department'}
                  {' · '}
                  {project.taskCount ?? 0} tasks
                </p>
              </td>

              <td className="px-5 py-4">
                <p>{project.client.name}</p>
                <p className="text-xs text-slate-400">
                  {project.client.companyName ?? ''}
                </p>
              </td>

              <td className="px-5 py-4">
                {project.projectManager?.fullName ?? '—'}
              </td>

              <td className="px-5 py-4">
                {formatDate(project.deadline)}
              </td>

              <td className="min-w-40 px-5 py-4">
                <div className="mb-1 flex justify-between text-xs">
                  <span>Progress</span>
                  <span className="font-semibold">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{
                      width: `${Math.min(
                        Math.max(project.progress ?? 0, 0),
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </td>

              <td className="px-5 py-4">
                <PriorityBadge priority={project.priority} />
              </td>

              <td className="px-5 py-4">
                <ProjectStatusBadge status={project.status} reviewStage={project.reviewStage} />
              </td>

              {showActions && (
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      title="View Project"
                      onClick={() => onView(project)}
                      className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {canCreateTaskForRow(project) && (
                      <Link
                        href={`/tasks?create=1&projectId=${project.id}${taskDepartmentIdForRow(project) ? `&departmentId=${taskDepartmentIdForRow(project)}` : ''}`}
                        title="Create Task"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                      >
                        <ListPlus className="h-4 w-4" />
                        Create Task
                      </Link>
                    )}

                    {canFullManage && (
                      <>
                        <button
                          type="button"
                          title="Edit Project"
                          onClick={() => onEdit(project)}
                          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          title="Manage Members"
                          onClick={() => onMembers(project)}
                          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                        >
                          <Users className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          title="Milestones"
                          onClick={() => onMilestones(project)}
                          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                        >
                          <Target className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          title="Delete / Archive"
                          onClick={() => void onDelete(project)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectHodView({
  project,
  showCreateTask,
  taskDepartmentId,
  clientServicingMode,
  saving,
  onSendToClient,
  onClientApproved,
  onClientChanges,
}: {
  project: Project;
  showCreateTask: boolean;
  taskDepartmentId: string;
  clientServicingMode: boolean;
  saving: boolean;
  onSendToClient: (project: Project) => Promise<void>;
  onClientApproved: (project: Project) => Promise<void>;
  onClientChanges: (
    project: Project,
    note: string,
    departmentIds: string[],
  ) => Promise<void>;
}) {
  const departmentNames = project.departments?.length
    ? project.departments.map((department) => department.name).join(', ')
    : project.department?.name ?? '—';

  const [feedback, setFeedback] = useState('');
  const [changeDepartmentIds, setChangeDepartmentIds] = useState<string[]>([]);

  const displayStatus = project.reviewStage
    ? project.reviewStage.replaceAll('_', ' ')
    : project.status === 'ACTIVE'
      ? 'IN PROGRESS'
      : project.status.replaceAll('_', ' ');

  const assignedDepartments = project.departments?.length
    ? project.departments
    : project.department
      ? [project.department]
      : [];

  const toggleChangeDepartment = (departmentId: string) => {
    setChangeDepartmentIds((current) =>
      current.includes(departmentId)
        ? current.filter((id) => id !== departmentId)
        : [...current, departmentId],
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <ProjectDetail label="Client" value={project.client.name} />
        <ProjectDetail label="Deadline" value={formatDate(project.deadline)} />
        <ProjectDetail label="Departments" value={departmentNames} />
        <ProjectDetail label="Tasks" value={String(project.taskCount ?? 0)} />
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Requirement / Brief
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
          {project.description?.trim() || '—'}
        </p>
      </div>

      {project.internalNotes?.trim() && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {project.internalNotes}
          </p>
        </div>
      )}

      {project.clientFeedback?.trim() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
            Client Feedback
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {project.clientFeedback}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ProjectDetail label="Status" value={displayStatus} />
        <ProjectDetail label="Progress" value={`${project.progress ?? 0}%`} />
      </div>

      {clientServicingMode &&
        project.status === 'UNDER_REVIEW' &&
        (!project.reviewStage || project.reviewStage === 'CLIENT_SERVICING_REVIEW') && (
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSendToClient(project)}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Please wait...' : 'Send to Client'}
            </button>
          </div>
        )}

      {clientServicingMode && project.reviewStage === 'CLIENT_REVIEW' && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (window.confirm('Mark this project as approved by the client?')) {
                  void onClientApproved(project);
                }
              }}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Client Approved
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">Changes Required</p>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Client feedback"
              rows={4}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {assignedDepartments.map((department) => (
                <label
                  key={department.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={changeDepartmentIds.includes(department.id)}
                    onChange={() => toggleChangeDepartment(department.id)}
                  />
                  {department.name}
                </label>
              ))}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={saving || !feedback.trim() || !changeDepartmentIds.length}
                onClick={() =>
                  void onClientChanges(project, feedback.trim(), changeDepartmentIds)
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50"
              >
                Send Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateTask && (
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Link
            href={`/tasks?create=1&projectId=${project.id}${taskDepartmentId ? `&departmentId=${taskDepartmentId}` : ''}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
          >
            <ListPlus className="h-4 w-4" />
            Create Task
          </Link>
        </div>
      )}
    </div>
  );
}

function ProjectDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {value || '—'}
      </p>
    </div>
  );
}

function ProjectForm({
  project,
  clients,
  initialClientId = '',
  clientServicingMode = false,
  departments,
  canUploadFiles,
  saving,
  onSubmit,
}: {
  project?: Project;
  clients: Client[];
  initialClientId?: string;
  clientServicingMode?: boolean;
  departments: Department[];
  canUploadFiles: boolean;
  saving: boolean;

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  const selectedDepartmentIds =
    project?.departments?.length
      ? project.departments.map(
          (department) =>
            department.id,
        )
      : project?.departmentId
        ? [project.departmentId]
        : [];

  const initialClient =
    project?.client ??
    clients.find(
      (client) =>
        client.id ===
        initialClientId,
    ) ??
    null;

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2"
    >
      <ClientTypeahead
        clients={clients}
        project={project}
        initialClientId={
          initialClientId
        }
      />

      <Input
        name="name"
        label="Project Name"
        required
        defaultValue={
          project?.name ?? ''
        }
      />

      <div className="sm:col-span-2">
        <DepartmentMultiSelector
          departments={
            departments
          }
          selectedIds={
            selectedDepartmentIds
          }
          label={
            clientServicingMode
              ? 'Relevant Departments'
              : 'Departments'
          }
        />
      </div>

      <Input
        name="deadline"
        label="Deadline / Expected Timeline"
        type="date"
        defaultValue={
          toDateInput(
            project?.deadline,
          )
        }
      />

      {!clientServicingMode && (
      <Select
        name="priority"
        label="Priority"
        defaultValue={
          project?.priority ??
          'MEDIUM'
        }
      >
        <option value="LOW">
          Low
        </option>

        <option value="MEDIUM">
          Medium
        </option>

        <option value="HIGH">
          High
        </option>

        <option value="URGENT">
          Urgent
        </option>
      </Select>
      )}

      <Textarea
        name="brief"
        label="Requirement / Brief"
        defaultValue={
          project?.description ??
          initialClient?.requirements ??
          ''
        }
      />

      <Textarea
        name="internalNotes"
        label="Internal Notes (Optional)"
        defaultValue={
          project?.internalNotes ??
          ''
        }
      />

      {canUploadFiles && !clientServicingMode && (
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Paperclip className="h-4 w-4" />
              Attachment
            </span>

            <input
              name="attachments"
              type="file"
              multiple
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
            />
          </label>
        </div>
      )}

      {canUploadFiles && !clientServicingMode && (
        <div className="sm:col-span-2">
          <CreateProjectVoiceInput
            initialTranscript={
              project
                ?.voiceTranscript ??
              ''
            }
            initialLanguage={
              project
                ?.voiceLanguage ??
              'gu'
            }
          />
        </div>
      )}

      <div className="sm:col-span-2">
        <SubmitButton
          saving={saving}
          label={
            project
              ? 'Save Project'
              : 'Create Project'
          }
        />
      </div>
    </form>
  );
}

function ClientTypeahead({
  clients,
  project,
  initialClientId = '',
}: {
  clients: Client[];
  project?: Project;
  initialClientId?: string;
}) {
  const initialClient =
    project?.client ??
    clients.find(
      (client) =>
        client.id === initialClientId,
    );

  const [clientText, setClientText] =
    useState(
      initialClient?.name ??
        '',
    );

  const [clientId, setClientId] =
    useState(
      project?.clientId ??
        initialClient?.id ??
        '',
    );

  const resolveClient = (
    value: string,
  ) => {
    const normalized =
      value
        .trim()
        .toLowerCase();

    const match =
      clients.find(
        (client) =>
          client.name
            .trim()
            .toLowerCase() ===
            normalized ||
          (client.companyName ??
            '')
            .trim()
            .toLowerCase() ===
            normalized,
      ) ?? null;

    setClientText(value);
    setClientId(
      match?.id ?? '',
    );
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        Client Name
      </span>

      <input
        required
        value={clientText}
        list="project-client-options"
        onChange={(event) =>
          resolveClient(
            event.target.value,
          )
        }
        onBlur={(event) =>
          resolveClient(
            event.target.value,
          )
        }
        placeholder="Type client name"
        autoComplete="off"
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
      />

      <input
        type="hidden"
        name="clientId"
        value={clientId}
        readOnly
      />

      <datalist id="project-client-options">
        {clients.map(
          (client) => (
            <option
              key={client.id}
              value={client.name}
            >
              {client.companyName ??
                client.name}
            </option>
          ),
        )}
      </datalist>
    </label>
  );
}

function DepartmentMultiSelector({
  departments,
  selectedIds,
  label = 'Departments',
}: {
  departments: Department[];
  selectedIds: string[];
  label?: string;
}) {
  const [search, setSearch] =
    useState('');

  const [
    selected,
    setSelected,
  ] = useState<string[]>(
    selectedIds,
  );

  const filteredDepartments =
    departments.filter(
      (department) =>
        department.name
          .toLowerCase()
          .includes(
            search
              .trim()
              .toLowerCase(),
          ),
    );

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        value={search}
        onChange={(event) =>
          setSearch(
            event.target.value,
          )
        }
        placeholder="Type department name"
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
      />

      {selected.map(
        (departmentId) => (
          <input
            key={departmentId}
            type="hidden"
            name="departmentIds"
            value={departmentId}
          />
        ),
      )}

      <div className="mt-2 max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
        {filteredDepartments.map(
          (department) => (
            <label
              key={department.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(
                  department.id,
                )}
                onChange={(
                  event,
                ) => {
                  setSelected(
                    (current) =>
                      event.target
                        .checked
                        ? [
                            ...current,
                            department.id,
                          ]
                        : current.filter(
                            (id) =>
                              id !==
                              department.id,
                          ),
                  );
                }}
              />

              <span className="text-sm text-slate-700">
                {department.name}
              </span>
            </label>
          ),
        )}

        {!filteredDepartments.length && (
          <div className="px-3 py-2 text-sm text-slate-400">
            No department found.
          </div>
        )}
      </div>
    </div>
  );
}

function CreateProjectVoiceInput({
  initialTranscript = '',
  initialLanguage = 'gu',
}: {
  initialTranscript?: string;
  initialLanguage?: string;
}) {
  const { authFetch } =
    useAuth();

  const [
    recording,
    setRecording,
  ] = useState(false);

  const [
    recordingSeconds,
    setRecordingSeconds,
  ] = useState(0);

  const [
    selectedFile,
    setSelectedFile,
  ] = useState<File | null>(
    null,
  );

  const [
    voiceError,
    setVoiceError,
  ] = useState('');

  const [
    transcribing,
    setTranscribing,
  ] = useState(false);

  const [
    transcript,
    setTranscript,
  ] = useState(
    initialTranscript,
  );

  const [
    transcriptLanguage,
    setTranscriptLanguage,
  ] = useState(
    initialLanguage,
  );

  const [
    transcriptionLanguage,
  ] = useState(
    initialLanguage || 'gu',
  );

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState('');

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

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
    useRef<ReturnType<
      typeof setInterval
    > | null>(null);

  const startedAtRef =
    useRef<number | null>(
      null,
    );

  const clearTimer =
    useCallback(() => {
      if (
        timerRef.current
      ) {
        clearInterval(
          timerRef.current,
        );

        timerRef.current =
          null;
      }
    }, []);

  const stopStream =
    useCallback(() => {
      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );

      streamRef.current =
        null;
    }, []);

  const applyFileToInput =
    useCallback(
      (
        file: File | null,
      ) => {
        const input =
          inputRef.current;

        if (!input) {
          return;
        }

        if (!file) {
          input.value = '';
          return;
        }

        try {
          const transfer =
            new DataTransfer();

          transfer.items.add(
            file,
          );

          input.files =
            transfer.files;
        } catch {}
      },
      [],
    );

  const setVoiceFile =
    useCallback(
      (
        file: File | null,
      ) => {
        setSelectedFile(
          file,
        );

        applyFileToInput(
          file,
        );

        setVoiceError('');
      },
      [applyFileToInput],
    );

  const transcribeFile =
    useCallback(
      async (
        file: File,
        mode: 'replace' | 'append' = 'replace',
      ) => {
        setTranscribing(true);
        setVoiceError('');

        try {
          const body = new FormData();
          body.append('file', file);

          if (transcriptionLanguage !== 'auto') {
            body.append('language', transcriptionLanguage);
          }

          const response = await authFetch(
            '/voice-notes/preview-transcribe',
            {
              method: 'POST',
              body,
            },
          );

          let result: unknown = null;

          try {
            result = await response.json();
          } catch {}

          if (!response.ok) {
            throw new Error(
              getErrorMessage(
                result,
                'Unable to transcribe this audio.',
              ),
            );
          }

          const payload = (result ?? {}) as {
            text?: string;
            language?: string | null;
          };

          const nextText = payload.text?.trim() ?? '';

          if (mode === 'append' && nextText) {
            setTranscript((current) =>
              current.trim()
                ? `${current.trimEnd()}
${nextText}`
                : nextText,
            );
          } else {
            setTranscript(nextText);
          }

          setTranscriptLanguage(
            payload.language?.trim() ||
              (transcriptionLanguage !== 'auto'
                ? transcriptionLanguage
                : ''),
          );
        } catch (error) {
          setVoiceError(
            error instanceof Error
              ? error.message
              : 'Unable to transcribe this audio.',
          );
        } finally {
          setTranscribing(false);
        }
      },
      [authFetch, transcriptionLanguage],
    );

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

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('');
      return;
    }

    const url =
      URL.createObjectURL(
        selectedFile,
      );

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(
        url,
      );
    };
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      clearTimer();

      const recorder =
        recorderRef.current;

      if (
        recorder &&
        recorder.state !==
          'inactive'
      ) {
        try {
          recorder.stop();
        } catch {}
      }

      stopStream();
    };
  }, [
    clearTimer,
    stopStream,
  ]);

  const startRecording =
    async () => {
      setVoiceError('');

      if (
        typeof MediaRecorder ===
          'undefined' ||
        !navigator.mediaDevices
          ?.getUserMedia
      ) {
        setVoiceError(
          'Microphone recording is not supported in this browser.',
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

        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
        ];

        const mimeType =
          candidates.find(
            (type) =>
              MediaRecorder.isTypeSupported(
                type,
              ),
          ) ?? '';

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
            clearTimer();

            const seconds =
              startedAtRef.current
                ? Math.max(
                    1,
                    Math.round(
                      (Date.now() -
                        startedAtRef.current) /
                        1000,
                    ),
                  )
                : Math.max(
                    1,
                    recordingSeconds,
                  );

            const finalMime =
              recorder.mimeType ||
              mimeType ||
              'audio/webm';

            const extension =
              finalMime.includes(
                'ogg',
              )
                ? 'ogg'
                : finalMime.includes(
                      'mp4',
                    )
                  ? 'm4a'
                  : 'webm';

            const file =
              new File(
                [
                  new Blob(
                    chunksRef.current,
                    {
                      type: finalMime,
                    },
                  ),
                ],
                `project-voice-${Date.now()}.${extension}`,
                {
                  type: finalMime,
                },
              );

            setVoiceFile(
              file,
            );

            setRecording(
              false,
            );

            setRecordingSeconds(
              Math.min(
                600,
                seconds,
              ),
            );

            startedAtRef.current =
              null;

            stopStream();

            void transcribeFile(
              file,
              'append',
            );
          };

        recorder.onerror =
          () => {
            setVoiceError(
              'Recording failed. Please try again.',
            );

            clearTimer();

            setRecording(
              false,
            );

            stopStream();
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
      } catch (error) {
        setVoiceError(
          error instanceof Error
            ? error.message
            : 'Microphone permission was not granted.',
        );

        setRecording(false);

        clearTimer();

        stopStream();
      }
    };

  const removeSelection =
    () => {
      setSelectedFile(null);

      applyFileToInput(
        null,
      );

      setVoiceError('');
    };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={
            recording
              ? finishRecording
              : () => void startRecording()
          }
          disabled={transcribing}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            recording
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {recording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {recording
            ? `Stop ${formatDurationShort(recordingSeconds)}`
            : 'Record Voice'}
        </button>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700">
          <Upload className="h-4 w-4" />
          Upload Audio
          <input
            ref={inputRef}
            name="voiceNote"
            type="file"
            accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a,.mp4,.aac"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;

              if (!file) {
                return;
              }

              setVoiceFile(file);
              setTranscript('');
              setTranscriptLanguage('');
              void transcribeFile(file, 'replace');
            }}
            className="hidden"
          />
        </label>

        {transcribing && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Transcribing...
          </span>
        )}
      </div>

      {voiceError && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {voiceError}
        </div>
      )}

      {selectedFile && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-700">
              {selectedFile.name}
            </p>
            {previewUrl && (
              <audio
                controls
                src={previewUrl}
                className="mt-1 h-8 w-full"
              />
            )}
          </div>
          <button
            type="button"
            onClick={removeSelection}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
            title="Remove voice note"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        type="hidden"
        name="voiceTranscriptLanguage"
        value={transcriptLanguage}
        readOnly
      />

      {(recording || transcribing || transcript) && (
        <textarea
          name="voiceTranscript"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          rows={1}
          ref={(element) => {
            if (!element) return;
            element.style.height = 'auto';
            element.style.height = `${Math.min(160, Math.max(40, element.scrollHeight))}px`;
          }}
          onInput={(event) => {
            const element = event.currentTarget;
            element.style.height = 'auto';
            element.style.height = `${Math.min(160, Math.max(40, element.scrollHeight))}px`;
          }}
          placeholder={
            recording
              ? 'Listening...'
              : transcribing
                ? 'Converting voice to text...'
                : 'Transcript'
          }
          className="w-full resize-none overflow-y-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-slate-400"
        />
      )}
    </div>
  );
}

function formatDurationShort(
  seconds: number,
) {
  const safe =
    Math.max(
      0,
      Math.floor(seconds),
    );

  const minutes =
    Math.floor(
      safe / 60,
    );

  const remaining =
    safe % 60;

  return `${minutes}:${String(
    remaining,
  ).padStart(2, '0')}`;
}

function MembersManager({
  project,
  employees,
  request,
  onChanged,
}: {
  project: Project;
  employees: Employee[];

  request: <T>(
    path: string,
    options?: RequestInit,
  ) => Promise<T>;

  onChanged: () => Promise<void>;
}) {
  const [saving, setSaving] =
    useState(false);

  const activeIds =
    project.members.map(
      (member) =>
        member.employee.id,
    );

  const saveMembers = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    const selectedIds =
      form
        .getAll('memberIds')
        .map(String);

    const addIds =
      selectedIds.filter(
        (id) =>
          !activeIds.includes(id),
      );

    const removeIds =
      activeIds.filter(
        (id) =>
          !selectedIds.includes(id),
      );

    const memberRole =
      String(
        form.get('memberRole') ??
          '',
      ).trim();

    setSaving(true);

    try {
      if (addIds.length) {
        await request(
          `/projects/${project.id}/members`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              employeeIds:
                addIds,

              memberRole:
                memberRole ||
                undefined,
            }),
          },
        );
      }

      if (removeIds.length) {
        await request(
          `/projects/${project.id}/members`,
          {
            method: 'DELETE',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              employeeIds:
                removeIds,
            }),
          },
        );
      }

      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={saveMembers}
      className="space-y-5"
    >
      <div>
        <p className="text-sm font-semibold text-slate-700">
          Project Manager
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {project.projectManager
            ?.fullName ??
            'Not assigned'}
        </p>
      </div>

      <Input
        name="memberRole"
        label="Role for newly added members"
        placeholder="Designer, Developer, Coordinator..."
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Team Members
        </p>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">
          {employees.map(
            (employee) => {
              const membership =
                project.members.find(
                  (member) =>
                    member.employee
                      .id ===
                    employee.id,
                );

              return (
                <label
                  key={employee.id}
                  className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="memberIds"
                      value={
                        employee.id
                      }
                      defaultChecked={activeIds.includes(
                        employee.id,
                      )}
                    />

                    <div>
                      <p className="text-sm font-semibold">
                        {
                          employee.fullName
                        }
                      </p>

                      <p className="text-xs text-slate-400">
                        {employee.designation ??
                          'No designation'}
                      </p>
                    </div>
                  </div>

                  {membership
                    ?.memberRole && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">
                      {
                        membership.memberRole
                      }
                    </span>
                  )}
                </label>
              );
            },
          )}
        </div>
      </div>

      <SubmitButton
        saving={saving}
        label="Save Members"
      />
    </form>
  );
}

function MilestonesManager({
  project,
  request,
  onChanged,
}: {
  project: Project;

  request: <T>(
    path: string,
    options?: RequestInit,
  ) => Promise<T>;

  onChanged: () => Promise<void>;
}) {
  const [saving, setSaving] =
    useState(false);

  const addMilestone = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const formElement =
      event.currentTarget;

    const form =
      new FormData(formElement);

    setSaving(true);

    try {
      await request(
        `/projects/${project.id}/milestones`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            title: String(
              form.get('title') ??
                '',
            ),

            description:
              String(
                form.get(
                  'description',
                ) ?? '',
              ) || undefined,

            dueDate:
              String(
                form.get(
                  'dueDate',
                ) ?? '',
              ) || undefined,

            status: 'PENDING',

            sortOrder:
              project.milestones
                .length + 1,
          }),
        },
      );

      formElement.reset();

      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    milestone: Milestone,
    status: MilestoneStatus,
  ) => {
    setSaving(true);

    try {
      await request(
        `/projects/${project.id}/milestones/${milestone.id}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            status,
          }),
        },
      );

      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const removeMilestone = async (
    milestone: Milestone,
  ) => {
    const confirmed =
      window.confirm(
        `Delete milestone "${milestone.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      await request(
        `/projects/${project.id}/milestones/${milestone.id}`,
        {
          method: 'DELETE',
        },
      );

      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-900">
              Current Milestones
            </p>

            <p className="text-xs text-slate-400">
              Project progress:{' '}
              {project.progress}%
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
            {
              project.milestones
                .length
            }{' '}
            milestones
          </span>
        </div>

        <div className="space-y-3">
          {project.milestones.map(
            (milestone) => (
              <div
                key={milestone.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {
                        milestone.title
                      }
                    </p>

                    {milestone.description && (
                      <p className="mt-1 text-sm text-slate-500">
                        {
                          milestone.description
                        }
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-400">
                      Due:{' '}
                      {formatDate(
                        milestone.dueDate,
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={
                        milestone.status
                      }
                      disabled={saving}
                      onChange={(
                        event,
                      ) =>
                        void changeStatus(
                          milestone,
                          event.target
                            .value as MilestoneStatus,
                        )
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <option value="PENDING">
                        Pending
                      </option>

                      <option value="IN_PROGRESS">
                        In Progress
                      </option>

                      <option value="COMPLETED">
                        Completed
                      </option>

                      <option value="MISSED">
                        Missed
                      </option>

                      <option value="CANCELLED">
                        Cancelled
                      </option>
                    </select>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void removeMilestone(
                          milestone,
                        )
                      }
                      className="rounded-lg border border-red-200 p-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ),
          )}

          {!project.milestones
            .length && (
            <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-400">
              No milestones yet.
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={addMilestone}
        className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <h3 className="font-bold">
            Add Milestone
          </h3>
        </div>

        <Input
          name="title"
          label="Milestone Title"
          required
        />

        <Input
          name="dueDate"
          label="Due Date"
          type="date"
        />

        <div className="sm:col-span-2">
          <Textarea
            name="description"
            label="Description"
          />
        </div>

        <div className="sm:col-span-2">
          <SubmitButton
            saving={saving}
            label="Add Milestone"
          />
        </div>
      </form>
    </div>
  );
}

function ModalBox({
  title,
  error,
  children,
  onClose,
}: {
  title: string;
  error: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-xl font-bold text-slate-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required = false,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={
          type === 'number'
            ? 0
            : undefined
        }
        step={
          type === 'number'
            ? 'any'
            : undefined
        }
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Textarea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={2}
        ref={(element) => {
          if (!element) return;
          element.style.height = 'auto';
          element.style.height = `${Math.max(42, element.scrollHeight)}px`;
        }}
        onInput={(event) => {
          const element = event.currentTarget;
          element.style.height = 'auto';
          element.style.height = `${Math.max(42, element.scrollHeight)}px`;
        }}
        className="w-full resize-none overflow-hidden rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Select({
  name,
  label,
  defaultValue,
  required = false,
  children,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
      >
        {children}
      </select>
    </label>
  );
}

function SubmitButton({
  saving,
  label,
}: {
  saving: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
    >
      {saving && (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}

      {label}
    </button>
  );
}

function ProjectStatusBadge({
  status,
  reviewStage,
}: {
  status: ProjectStatus;
  reviewStage?: ProjectReviewStage | null;
}) {
  const styles: Record<ProjectStatus, string> = {
    PLANNING: 'bg-blue-50 text-blue-700',
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    ON_HOLD: 'bg-amber-50 text-amber-700',
    UNDER_REVIEW: 'bg-violet-50 text-violet-700',
    COMPLETED: 'bg-green-50 text-green-700',
    CANCELLED: 'bg-red-50 text-red-700',
    ARCHIVED: 'bg-slate-100 text-slate-600',
  };

  const label = reviewStage
    ? reviewStage.replaceAll('_', ' ')
    : status === 'ACTIVE'
      ? 'IN PROGRESS'
      : status.replaceAll('_', ' ');

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {label}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  const styles: Record<
    Priority,
    string
  > = {
    LOW:
      'bg-slate-100 text-slate-600',

    MEDIUM:
      'bg-blue-50 text-blue-700',

    HIGH:
      'bg-orange-50 text-orange-700',

    URGENT:
      'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '—';
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
}

function toDateInput(
  value?: string | null,
) {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}