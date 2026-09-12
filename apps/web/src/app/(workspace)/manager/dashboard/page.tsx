'use client';

import Link from 'next/link';
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Users,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';

type WorkspaceIdentity = {
  fullName: string;
  designation: string | null;
  department?: { id: string; name: string } | null;
  managedDepartments?: Array<{ id: string; name: string }>;
};

type HrEmployee = {
  id: string;
  employeeId?: string | null;
  fullName: string;
  role: string;
  joinDate?: string | null;
  department?: { id: string; name: string } | null;
  workspaceStatus: 'PENDING_LOGIN' | 'WORKSPACE_READY';
};

type HrDashboardData = {
  totalEmployees: number;
  employees: HrEmployee[];
};

type ClientOnboardingStage =
  | 'DRAFT'
  | 'TERMS_SHARED'
  | 'AWAITING_CLIENT_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'FOLLOW_UP';

type ClientAccountsStage =
  | 'NEW_HANDOVER'
  | 'QUOTATION_PREPARED'
  | 'AWAITING_CLIENT_CONFIRMATION'
  | 'READY_FOR_CLIENT_SERVICING'
  | 'HANDED_TO_CLIENT_SERVICING';

type BdmClient = {
  id: string;
  name: string;
  companyName: string | null;
  requirements: string | null;
  onboardingStage: ClientOnboardingStage;
  createdAt: string;
  updatedAt?: string | null;
  accountsHandoverAt?: string | null;
};

type ClientResponse = {
  data: BdmClient[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type BdmDashboardData = {
  totalClients: number;
  awaitingApproval: number;
  approved: number;
  followUpRequired: number;
  recentClients: BdmClient[];
};

type AccountsClient = {
  id: string;
  name: string;
  companyName: string | null;
  requirements: string | null;
  accountsStage: ClientAccountsStage | null;
  accountsHandoverAt: string | null;
  quotationNumber: string | null;
  quotationAmount: number | null;
  quotationDetails: string | null;
  billingDetails: string | null;
  quotationPreparedAt: string | null;
  quotationSentAt: string | null;
  clientCommercialConfirmedAt: string | null;
  clientServicingHandoverAt: string | null;
};

type AccountsDashboardData = {
  newHandovers: number;
  pendingQuotations: number;
  totalQuotations: number;
  teamTotalQuotations?: number;
  quotationPreparedByName?: string | null;
  quotationPrepared: number;
  awaitingClientConfirmation: number;
  readyForClientServicing: number;
  handedToClientServicing: number;
  recentClients: AccountsClient[];
};

type ClientServicingProject = {
  id: string;
  name: string;
  status:
    | 'PLANNING'
    | 'ACTIVE'
    | 'ON_HOLD'
    | 'UNDER_REVIEW'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'ARCHIVED';
  deadline: string | null;
  createdAt: string;
  departments: Array<{
    id: string;
    name: string;
  }>;
};

type ClientServicingHandover = {
  id: string;
  name: string;
  companyName: string | null;
  requirements: string | null;
  clientServicingHandoverAt: string | null;
  hasProject: boolean;
  project: ClientServicingProject | null;
};

type ClientServicingDashboardData = {
  newHandovers: number;
  projectsToCreate: number;
  activeProjects: number;
  awaitingDepartmentAssignment: number;
  inProgress: number;
  awaitingClientReview: number;
  completedProjects: number;
  recentHandovers: ClientServicingHandover[];
};

function getMessage(value: unknown, fallback: string) {
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const message = (value as { message?: string | string[] }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function normalizeDepartmentName(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isHrDepartment(value?: string | null) {
  const n = normalizeDepartmentName(value);
  return n === 'hr' || n === 'humanresources';
}

function isBdmDepartment(value?: string | null) {
  const n = normalizeDepartmentName(value);
  return ['businessdevelopment', 'businessdevelopmentmanager', 'businessdevelopmentdepartment', 'bdm', 'bd'].includes(n);
}

function isAccountsDepartment(value?: string | null) {
  const n = normalizeDepartmentName(value);
  return ['accounts', 'account', 'accountsquotation', 'accountsandquotation', 'accountsfinance', 'accountsandfinance', 'finance'].includes(n);
}

function isClientServicingDepartment(value?: string | null) {
  const n = normalizeDepartmentName(value);
  return [
    'clientservicing',
    'clientservice',
    'clientservicingdepartment',
    'clientrelations',
    'clientrelationship',
  ].includes(n);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

function stageLabel(stage: ClientOnboardingStage) {
  const labels: Record<ClientOnboardingStage, string> = {
    DRAFT: 'Draft',
    TERMS_SHARED: 'T&C Shared',
    AWAITING_CLIENT_APPROVAL: 'Awaiting Approval',
    APPROVED: 'Approved · Accounts',
    REJECTED: 'Not Approved',
    FOLLOW_UP: 'Follow-up',
  };
  return labels[stage];
}

function stageClass(stage: ClientOnboardingStage) {
  if (stage === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
  if (stage === 'AWAITING_CLIENT_APPROVAL') return 'bg-amber-50 text-amber-700';
  if (stage === 'REJECTED' || stage === 'FOLLOW_UP') return 'bg-rose-50 text-rose-700';
  if (stage === 'TERMS_SHARED') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

function accountsStageLabel(stage?: ClientAccountsStage | null) {
  const value = stage ?? 'NEW_HANDOVER';
  const labels: Record<ClientAccountsStage, string> = {
    NEW_HANDOVER: 'New Handover',
    QUOTATION_PREPARED: 'Quotation Prepared',
    AWAITING_CLIENT_CONFIRMATION: 'Quotation Sent · Awaiting Client',
    READY_FOR_CLIENT_SERVICING: 'Ready for Client Servicing',
    HANDED_TO_CLIENT_SERVICING: 'Handed to Client Servicing',
  };
  return labels[value];
}

function accountsStageClass(stage?: ClientAccountsStage | null) {
  const value = stage ?? 'NEW_HANDOVER';
  if (value === 'HANDED_TO_CLIENT_SERVICING') return 'bg-emerald-50 text-emerald-700';
  if (value === 'READY_FOR_CLIENT_SERVICING') return 'bg-violet-50 text-violet-700';
  if (value === 'AWAITING_CLIENT_CONFIRMATION') return 'bg-amber-50 text-amber-700';
  if (value === 'QUOTATION_PREPARED') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

export default function ManagerDashboardPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(null);
  const [hrData, setHrData] = useState<HrDashboardData | null>(null);
  const [bdmData, setBdmData] = useState<BdmDashboardData | null>(null);
  const [accountsData, setAccountsData] = useState<AccountsDashboardData | null>(null);
  const [clientServicingData, setClientServicingData] = useState<ClientServicingDashboardData | null>(null);
  const [quotationClient, setQuotationClient] = useState<AccountsClient | null>(null);
  const [savingAccounts, setSavingAccounts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const departmentNames = useMemo(() => [
    identity?.department?.name ?? '',
    ...(identity?.managedDepartments ?? []).map((department) => department.name),
  ].filter(Boolean), [identity]);

  const isHrManager = departmentNames.some(isHrDepartment);
  const isBdmManager = departmentNames.some(isBdmDepartment);
  const isAccountsManager = departmentNames.some(isAccountsDepartment);
  const isClientServicingManager = departmentNames.some(isClientServicingDepartment);

  const request = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await authFetch(path, options);
    let result: unknown = null;
    try { result = await response.json(); } catch { result = null; }
    if (!response.ok) throw new Error(getMessage(result, 'Request failed.'));
    return result as T;
  }, [authFetch]);

  const loadBdmDashboard = useCallback(async () => {
    const count = async (stage?: ClientOnboardingStage) => {
      const params = new URLSearchParams({ page: '1', limit: '1' });
      if (stage) params.set('onboardingStage', stage);
      const result = await request<ClientResponse>(`/clients?${params.toString()}`);
      return result.meta.total;
    };
    const recentParams = new URLSearchParams({ page: '1', limit: '20', sortBy: 'createdAt', sortOrder: 'desc' });
    const [totalClients, awaitingApproval, approved, followUp, rejected, recent] = await Promise.all([
      count(), count('AWAITING_CLIENT_APPROVAL'), count('APPROVED'), count('FOLLOW_UP'), count('REJECTED'),
      request<ClientResponse>(`/clients?${recentParams.toString()}`),
    ]);
    setBdmData({ totalClients, awaitingApproval, approved, followUpRequired: followUp + rejected, recentClients: recent.data });
  }, [request]);

  const loadAccountsDashboard = useCallback(async () => {
    const result = await request<AccountsDashboardData>('/clients/accounts-dashboard');
    setAccountsData(result);
  }, [request]);

  const loadClientServicingDashboard = useCallback(async () => {
    const result = await request<ClientServicingDashboardData>('/clients/client-servicing-dashboard');
    setClientServicingData(result);
  }, [request]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const currentIdentity = await request<WorkspaceIdentity>('/employees/me');
      setIdentity(currentIdentity);
      const names = [
        currentIdentity.department?.name ?? '',
        ...(currentIdentity.managedDepartments ?? []).map((department) => department.name),
      ].filter(Boolean);
      const hasBdm = names.some(isBdmDepartment);
      const hasHr = names.some(isHrDepartment);
      const hasAccounts = names.some(isAccountsDepartment);
      const hasClientServicing = names.some(isClientServicingDepartment);
      if (!hasBdm && !hasHr && !hasAccounts && !hasClientServicing) {
        router.replace('/tasks');
        return;
      }
      const jobs: Promise<unknown>[] = [];
      if (hasBdm) jobs.push(loadBdmDashboard());
      if (hasAccounts) jobs.push(loadAccountsDashboard());
      if (hasClientServicing) jobs.push(loadClientServicingDashboard());
      if (hasHr) {
        jobs.push(request<HrDashboardData>('/employees/hr-dashboard').then((result) => {
          setHrData({
            totalEmployees: typeof result?.totalEmployees === 'number' ? result.totalEmployees : 0,
            employees: Array.isArray(result?.employees) ? result.employees : [],
          });
        }));
      }
      await Promise.all(jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [loadAccountsDashboard, loadBdmDashboard, loadClientServicingDashboard, request, router]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const updateAccountsStage = useCallback(async (
    client: AccountsClient,
    stage: Exclude<ClientAccountsStage, 'NEW_HANDOVER'>,
    extra?: Record<string, unknown>,
  ) => {
    setSavingAccounts(true);
    setError('');
    try {
      await request(`/clients/${client.id}/accounts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, ...extra }),
      });
      setQuotationClient(null);
      await loadAccountsDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accounts workflow update failed.');
    } finally {
      setSavingAccounts(false);
    }
  }, [loadAccountsDashboard, request]);

  const saveQuotation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quotationClient) return;
    const form = new FormData(event.currentTarget);
    const rawAmount = String(form.get('quotationAmount') ?? '').replace(/,/g, '').trim();
    const amount = rawAmount ? Number(rawAmount) : undefined;
    await updateAccountsStage(quotationClient, 'QUOTATION_PREPARED', {
      quotationNumber: String(form.get('quotationNumber') ?? '').trim(),
      quotationAmount: amount,
      quotationDetails: String(form.get('quotationDetails') ?? '').trim() || undefined,
      billingDetails: String(form.get('billingDetails') ?? '').trim() || undefined,
    });
  };

  if (loading && !hrData && !bdmData && !accountsData && !clientServicingData) {
    return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;
  }

  const visibleSectionCount = [
    Boolean((isBdmManager || bdmData) && bdmData),
    Boolean((isAccountsManager || accountsData) && accountsData),
    Boolean(
      (isClientServicingManager || clientServicingData) &&
        clientServicingData,
    ),
    Boolean((isHrManager || hrData) && hrData),
  ].filter(Boolean).length;

  const showSectionLabels = visibleSectionCount > 1;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      {(isBdmManager || bdmData) && bdmData && (
        <BdmSection data={bdmData} showLabel={showSectionLabels} />
      )}

      {(isAccountsManager || accountsData) && accountsData && (
        <AccountsSection
          data={accountsData}
          saving={savingAccounts}
          onCreateQuotation={setQuotationClient}
          onAdvance={(client, stage) => void updateAccountsStage(client, stage)}
          showLabel={showSectionLabels}
        />
      )}

      {(isClientServicingManager || clientServicingData) && clientServicingData && (
        <ClientServicingSection data={clientServicingData} showLabel={showSectionLabels} />
      )}

      {(isHrManager || hrData) && hrData && (
        <HrSection data={hrData} showLabel={showSectionLabels} />
      )}

      {quotationClient && (
        <QuotationModal
          client={quotationClient}
          saving={savingAccounts}
          onClose={() => setQuotationClient(null)}
          onSubmit={saveQuotation}
        />
      )}
    </div>
  );
}

function BdmSection({
  data,
  showLabel,
}: {
  data: BdmDashboardData;
  showLabel: boolean;
}) {
  const attentionClients = data.recentClients.filter((client) => client.onboardingStage !== 'APPROVED').slice(0, 6);
  return (
    <section className="space-y-4">
      <div className={`flex items-center gap-3 ${showLabel ? 'justify-between' : 'justify-end'}`}>
        {showLabel && (
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">
            Business Development
          </p>
        )}
        <Link href="/clients?new=1" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" />Add Client</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Clients" value={data.totalClients} icon={Users} href="/clients" />
        <MetricCard label="Awaiting Approval" value={data.awaitingApproval} icon={Clock3} href="/clients?onboardingStage=AWAITING_CLIENT_APPROVAL" />
        <MetricCard label="Approved" value={data.approved} icon={CheckCircle2} href="/clients?onboardingStage=APPROVED" />
        <MetricCard label="Follow-up Required" value={data.followUpRequired} icon={RotateCcw} href="/clients?onboardingStage=FOLLOW_UP" />
      </div>
      <DashboardCard title="Clients Needing Attention" subtitle="Open onboarding items that still need a BDM action.">
        <ClientTable clients={attentionClients} emptyText="No client needs attention right now." />
      </DashboardCard>
      <DashboardCard title="Recent Client Onboarding" subtitle="Latest client records and their current onboarding stage.">
        <ClientTable clients={data.recentClients.slice(0, 8)} emptyText="No clients have been added yet." />
      </DashboardCard>
    </section>
  );
}

function AccountsSection({
  data,
  saving,
  onCreateQuotation,
  onAdvance,
  showLabel,
}: {
  data: AccountsDashboardData;
  saving: boolean;
  onCreateQuotation: (client: AccountsClient) => void;
  onAdvance: (client: AccountsClient, stage: Exclude<ClientAccountsStage, 'NEW_HANDOVER'>) => void;
  showLabel: boolean;
}) {
  const openClients = data.recentClients.filter((client) => (client.accountsStage ?? 'NEW_HANDOVER') !== 'HANDED_TO_CLIENT_SERVICING');
  return (
    <section id="accounts-workflow" className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      {showLabel && (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">
          Accounts & Quotation
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending Quotations" value={data.pendingQuotations} icon={BadgeIndianRupee} href="#accounts-workflow" />
        <MetricCard label="Total Quotations" subtitle={data.quotationPreparedByName ?? undefined} value={data.totalQuotations ?? data.quotationPrepared} icon={FileCheck2} href="#accounts-workflow" />
        <MetricCard label="Awaiting Client Confirmation" value={data.awaitingClientConfirmation} icon={Clock3} href="#accounts-workflow" />
        <MetricCard label="Ready for Client Servicing" value={data.readyForClientServicing} icon={CheckCircle2} href="#accounts-workflow" />
      </div>
      <DashboardCard title="Accounts Clients" subtitle={`${data.newHandovers} new handover(s) · ${data.handedToClientServicing} handed to Client Servicing`}>
        <AccountsTable clients={openClients} saving={saving} onCreateQuotation={onCreateQuotation} onAdvance={onAdvance} />
      </DashboardCard>
    </section>
  );
}

function ClientServicingSection({
  data,
  showLabel,
}: {
  data: ClientServicingDashboardData;
  showLabel: boolean;
}) {
  return (
    <section id="client-servicing-workflow" className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <div className={`flex items-center gap-3 ${showLabel ? 'justify-between' : 'justify-end'}`}>
        {showLabel && (
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
            Client Servicing
          </p>
        )}
        <Link href="/projects?new=1" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
          <Plus className="h-4 w-4" />
          Create Project
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="New Handovers" value={data.newHandovers} icon={Users} href="#client-servicing-handovers" />
        <MetricCard label="Projects to Create" value={data.projectsToCreate} icon={Plus} href="#client-servicing-handovers" />
        <MetricCard label="Active Projects" value={data.activeProjects} icon={CheckCircle2} href="/projects?status=ACTIVE" />
        <MetricCard label="To Do" value={data.awaitingDepartmentAssignment} icon={Clock3} href="/projects?status=PLANNING" />
        <MetricCard label="In Progress" value={data.inProgress} icon={FileCheck2} href="/projects?status=ACTIVE" />
        <MetricCard label="Awaiting Client Review" value={data.awaitingClientReview} icon={RotateCcw} href="/projects?status=UNDER_REVIEW" />
        <MetricCard label="Completed Projects" value={data.completedProjects} icon={CheckCircle2} href="/projects?status=COMPLETED" />
      </div>

      <DashboardCard
        title="Received from Accounts"
      >
        <ClientServicingTable clients={data.recentHandovers} />
      </DashboardCard>
    </section>
  );
}

function ClientServicingTable({
  clients,
}: {
  clients: ClientServicingHandover[];
}) {
  if (!clients.length) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-500">
        No Client Servicing handovers yet.
      </div>
    );
  }

  return (
    <div id="client-servicing-handovers" className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left font-semibold text-slate-600">Client</th>
            <th className="px-6 py-3 text-left font-semibold text-slate-600">Requirement / Brief</th>
            <th className="px-6 py-3 text-left font-semibold text-slate-600">Received</th>
            <th className="px-6 py-3 text-left font-semibold text-slate-600">Project</th>
            <th className="px-6 py-3 text-right font-semibold text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {clients.map((client) => (
            <tr key={client.id}>
              <td className="px-6 py-4">
                <p className="font-bold text-slate-900">{client.companyName ?? client.name}</p>
                {client.companyName && <p className="mt-1 text-xs text-slate-400">{client.name}</p>}
              </td>
              <td className="max-w-md px-6 py-4 text-slate-600">
                <p className="line-clamp-3">{client.requirements ?? 'No requirement / brief added.'}</p>
              </td>
              <td className="px-6 py-4 text-slate-500">{formatDate(client.clientServicingHandoverAt)}</td>
              <td className="px-6 py-4">
                {client.project ? (
                  <div>
                    <p className="font-semibold text-slate-800">{client.project.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {client.project.status === 'ACTIVE' ? 'IN PROGRESS' : client.project.status === 'PLANNING' ? 'TO DO' : client.project.status.replaceAll('_', ' ')}
                      {client.project.departments.length
                        ? ` · ${client.project.departments.map((department) => department.name).join(', ')}`
                        : ''}
                    </p>
                  </div>
                ) : (
                  <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    Project not created
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-right">
                {client.hasProject ? (
                  <Link href="/projects" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                    Open Project
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <Link href={`/projects?new=1&clientId=${encodeURIComponent(client.id)}`} className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800">
                    Create Project
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HrSection({
  data,
  showLabel,
}: {
  data: HrDashboardData;
  showLabel: boolean;
}) {
  return (
    <section className="space-y-4 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      {showLabel && (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">
          Human Resources
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Total Employees" value={data.totalEmployees} icon={Users} href="/manager/employees/new" /></div>
      <DashboardCard title="Employees Added by HR" subtitle="Latest HR-created employee records.">
        {!data.employees.length ? <div className="px-6 py-10 text-center text-sm text-slate-500">No employees added by HR yet.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left font-semibold text-slate-600">Employee</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Role</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Department</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Join Date</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data.employees.map((employee) => <tr key={employee.id}><td className="px-6 py-4 font-semibold text-slate-900">{employee.fullName}</td><td className="px-6 py-4 text-slate-600">{employee.role || '—'}</td><td className="px-6 py-4 text-slate-600">{employee.department?.name || '—'}</td><td className="px-6 py-4 text-slate-600">{formatDate(employee.joinDate)}</td><td className="px-6 py-4"><span className={employee.workspaceStatus === 'WORKSPACE_READY' ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'}>{employee.workspaceStatus === 'WORKSPACE_READY' ? 'Workspace Ready' : 'Pending Login'}</span></td></tr>)}</tbody></table></div>
        )}
      </DashboardCard>
    </section>
  );
}

function DashboardCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-6 py-5"><h3 className="text-lg font-black text-slate-950">{title}</h3>{subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}</div>{children}</section>;
}

function MetricCard({ label, value, icon: Icon, href, subtitle }: { label: string; value: number; icon: typeof Users; href: string; subtitle?: string }) {
  return <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">{label}</p>{subtitle ? <p className="mt-1 text-xs font-bold text-slate-700">{subtitle}</p> : null}<p className={`${subtitle ? 'mt-1.5' : 'mt-2'} text-3xl font-black text-slate-950`}>{value}</p></div><div className="rounded-xl bg-slate-100 p-3 text-slate-700 transition group-hover:bg-violet-50 group-hover:text-violet-700"><Icon className="h-5 w-5" /></div></div></Link>;
}

function ClientTable({ clients, emptyText }: { clients: BdmClient[]; emptyText: string }) {
  if (!clients.length) return <div className="px-6 py-10 text-center text-sm text-slate-500">{emptyText}</div>;
  return <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left font-semibold text-slate-600">Client</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Requirement</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Stage</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Last Update</th><th className="px-6 py-3 text-right font-semibold text-slate-600">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{clients.map((client) => <tr key={client.id}><td className="px-6 py-4"><p className="font-bold text-slate-900">{client.companyName ?? client.name}</p>{client.companyName && <p className="mt-1 text-xs text-slate-400">{client.name}</p>}</td><td className="max-w-sm px-6 py-4 text-slate-600"><p className="line-clamp-2">{client.requirements ?? 'Requirement not added yet.'}</p></td><td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stageClass(client.onboardingStage)}`}>{stageLabel(client.onboardingStage)}</span></td><td className="px-6 py-4 text-slate-500">{formatDate(client.updatedAt ?? client.createdAt)}</td><td className="px-6 py-4 text-right"><Link href="/clients" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50">Open<ArrowRight className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody></table></div>;
}

function AccountsTable({ clients, saving, onCreateQuotation, onAdvance }: { clients: AccountsClient[]; saving: boolean; onCreateQuotation: (client: AccountsClient) => void; onAdvance: (client: AccountsClient, stage: Exclude<ClientAccountsStage, 'NEW_HANDOVER'>) => void }) {
  if (!clients.length) return <div className="px-6 py-10 text-center text-sm text-slate-500">No pending Accounts client handovers.</div>;
  return <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left font-semibold text-slate-600">Client</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Accounts Stage</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Quotation</th><th className="px-6 py-3 text-left font-semibold text-slate-600">Received</th><th className="px-6 py-3 text-right font-semibold text-slate-600">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{clients.map((client) => {
    const stage = client.accountsStage ?? 'NEW_HANDOVER';
    return <tr key={client.id}><td className="px-6 py-4"><p className="font-bold text-slate-900">{client.companyName ?? client.name}</p><p className="mt-1 max-w-xs line-clamp-1 text-xs text-slate-500">{client.requirements ?? 'No requirement note'}</p></td><td className="px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${accountsStageClass(stage)}`}>{accountsStageLabel(stage)}</span></td><td className="px-6 py-4 text-slate-600">{client.quotationNumber ? <><p className="font-semibold text-slate-800">{client.quotationNumber}</p><p className="mt-1 text-xs">{formatCurrency(client.quotationAmount)}</p></> : '—'}</td><td className="px-6 py-4 text-slate-500">{formatDate(client.accountsHandoverAt)}</td><td className="px-6 py-4 text-right"><div className="flex justify-end gap-2">{stage === 'NEW_HANDOVER' && <button disabled={saving} onClick={() => onCreateQuotation(client)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Create Quotation</button>}{stage === 'QUOTATION_PREPARED' && <button disabled={saving} onClick={() => onAdvance(client, 'AWAITING_CLIENT_CONFIRMATION')} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5" />Mark Sent</button>}{stage === 'AWAITING_CLIENT_CONFIRMATION' && <><button disabled={saving} onClick={() => onCreateQuotation(client)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Revise</button><button disabled={saving} onClick={() => onAdvance(client, 'READY_FOR_CLIENT_SERVICING')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Client Confirmed</button></>}{stage === 'READY_FOR_CLIENT_SERVICING' && <button disabled={saving} onClick={() => onAdvance(client, 'HANDED_TO_CLIENT_SERVICING')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Hand Over to Client Servicing</button>}</div></td></tr>;
  })}</tbody></table></div>;
}

function QuotationModal({ client, saving, onClose, onSubmit }: { client: AccountsClient; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><h3 className="text-xl font-black text-slate-950">Create / Update Quotation</h3><p className="mt-1 text-xs text-slate-500">{client.companyName ?? client.name}</p></div><button onClick={onClose} type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><form onSubmit={onSubmit} className="grid gap-4 p-6 sm:grid-cols-2"><label className="space-y-1.5"><span className="text-xs font-bold text-slate-600">Quotation Number</span><input name="quotationNumber" required defaultValue={client.quotationNumber ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label><label className="space-y-1.5"><span className="text-xs font-bold text-slate-600">Quotation Amount (INR) <span className="font-medium text-slate-400">Optional</span></span><input name="quotationAmount" min="0" step="0.01" type="number" defaultValue={client.quotationAmount ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label><label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-bold text-slate-600">Quotation / Commercial Details</span><textarea name="quotationDetails" rows={4} defaultValue={client.quotationDetails ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label><label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-bold text-slate-600">Billing Details</span><textarea name="billingDetails" rows={3} defaultValue={client.billingDetails ?? ''} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400" /></label><div className="flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Cancel</button><button disabled={saving} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save Quotation'}</button></div></form></div></div>;
}
