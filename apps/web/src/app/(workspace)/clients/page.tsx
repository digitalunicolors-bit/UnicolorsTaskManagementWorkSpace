'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  CheckCircle2,
  Clock3,
  Edit3,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/auth-provider';
import { appDialog } from '@/components/ui/app-dialog-provider';

type ClientStatus =
  | 'LEAD'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'INACTIVE'
  | 'COMPLETED';

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

type ScopeCommitments = {
  columns: string[];
  rows: string[][];
};

interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  designation: string | null;
}

interface Client {
  id: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  deliverables: string[];
  primaryContacts: string[];
  status: ClientStatus;
  onboardingStage: ClientOnboardingStage;
  requirements: string | null;
  scopeCommitments: ScopeCommitments | null;
  paymentRemark: string | null;
  termsConditions: string | null;
  termsSharedAt: string | null;
  clientApprovalAt: string | null;
  clientApprovalNote: string | null;
  accountsHandoverAt: string | null;
  accountsStage: ClientAccountsStage | null;
  quotationNumber: string | null;
  quotationApprovedAt: string | null;
  quotationApprovalNote: string | null;
  isActive: boolean;
  createdAt: string;
  accountManager: Employee | null;
  clientServicing: Employee | null;
  activeProjects: number;
  completedProjects: number;
  totalProjects: number;
}

interface ClientResponse {
  data: Client[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface WorkflowAccess {
  userId: string | null;
  employeeId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isBusinessDevelopment: boolean;
  isSuperAdmin: boolean;
  canOnboard: boolean;
  canManageAll: boolean;
  canManageApprovedClient: boolean;
}

type Modal = 'create' | 'edit' | null;

function errorMessage(
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

    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

function splitValues(
  value: FormDataEntryValue | null,
) {
  return String(value ?? '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scopeCommitmentsFromForm(form: FormData): ScopeCommitments | undefined {
  const raw = String(form.get('scopeCommitmentsJson') ?? '').trim();
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as ScopeCommitments;
    if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) {
      return undefined;
    }

    return {
      columns: parsed.columns.map((column) => String(column).trim()).filter(Boolean),
      rows: parsed.rows.map((row) =>
        Array.isArray(row) ? row.map((value) => String(value ?? '').trim()) : [],
      ),
    };
  } catch {
    return undefined;
  }
}

export default function ClientsPage() {
  const {
    authFetch,
    hasPermission,
  } = useAuth();
  const [clients, setClients] =
    useState<Client[]>([]);
  const [workflowAccess, setWorkflowAccess] =
    useState<WorkflowAccess | null>(null);
  const [search, setSearch] = useState('');
  const [onboardingStage, setOnboardingStage] =
    useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [selectedClient, setSelectedClient] =
    useState<Client | null>(null);

  const canDelete =
    Boolean(workflowAccess?.canManageAll) &&
    hasPermission('clients.manage');

  const request = useCallback(
    async <T,>(
      path: string,
      options?: RequestInit,
    ): Promise<T> => {
      const response = await authFetch(
        path,
        options,
      );

      let data: unknown = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          errorMessage(
            data,
            'Request failed.',
          ),
        );
      }

      return data as T;
    },
    [authFetch],
  );

  const loadWorkflowAccess =
    useCallback(async () => {
      try {
        const result =
          await request<WorkflowAccess>(
            '/clients/workflow-access',
          );
        setWorkflowAccess(result);
      } catch {
        setWorkflowAccess(null);
      }
    }, [request]);

  const loadClients =
    useCallback(async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        params.set('sortBy', 'createdAt');
        params.set('sortOrder', 'desc');

        if (search.trim()) {
          params.set('search', search.trim());
        }

        if (onboardingStage) {
          params.set(
            'workflowStage',
            onboardingStage,
          );
        }

        const result =
          await request<ClientResponse>(
            `/clients?${params.toString()}`,
          );

        setClients(result.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load clients.',
        );
      } finally {
        setLoading(false);
      }
    }, [
      request,
      search,
      onboardingStage,
    ]);

  useEffect(() => {
    void loadWorkflowAccess();
  }, [loadWorkflowAccess]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClients();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadClients]);

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search,
    );

    const workflowStage = params.get('workflowStage');
    const legacyStage = params.get('onboardingStage');

    if (workflowStage) {
      setOnboardingStage(workflowStage);
    } else if (legacyStage) {
      const mapped: Record<string, string> = {
        DRAFT: 'ONBOARDING',
        TERMS_SHARED: 'ONBOARDING',
        FOLLOW_UP: 'ONBOARDING',
        AWAITING_CLIENT_APPROVAL: 'CLIENT_APPROVAL',
        APPROVED: 'QUOTATION',
        REJECTED: 'UNAPPROVED',
      };
      setOnboardingStage(mapped[legacyStage] ?? '');
    }

    if (
      params.get('new') === '1' &&
      workflowAccess?.canOnboard
    ) {
      setSelectedClient(null);
      setModal('create');
    }
  }, [workflowAccess]);

  const closeModal = () => {
    setModal(null);
    setSelectedClient(null);
    setError('');
  };

  const createClient = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const form = new FormData(
      event.currentTarget,
    );

    setSaving(true);
    setError('');

    try {
      await request<Client>('/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: String(
            form.get('companyName') ?? '',
          ).trim(),
          name: String(
            form.get('brandName') ?? '',
          ).trim(),
          email:
            String(
              form.get('email') ?? '',
            ).trim() || undefined,
          phone:
            String(
              form.get('phone') ?? '',
            ).trim() || undefined,
          requirements:
            String(
              form.get('requirements') ?? '',
            ).trim() || undefined,
          scopeCommitments: scopeCommitmentsFromForm(form),
          paymentRemark:
            String(form.get('paymentRemark') ?? '').trim() || undefined,
          termsConditions:
            String(
              form.get('termsConditions') ?? '',
            ).trim() || undefined,
          deliverables: splitValues(
            form.get('deliverables'),
          ),
          primaryContacts: splitValues(
            form.get('primaryContacts'),
          ),
        }),
      });

      closeModal();
      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Client creation failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateClient = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedClient) {
      return;
    }

    const form = new FormData(
      event.currentTarget,
    );

    setSaving(true);
    setError('');

    try {
      await request<Client>(
        `/clients/${selectedClient.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: String(
              form.get('companyName') ?? '',
            ).trim(),
            name: String(
              form.get('brandName') ?? '',
            ).trim(),
            email:
              String(
                form.get('email') ?? '',
              ).trim() || undefined,
            phone: String(
              form.get('phone') ?? '',
            ).trim(),
            requirements: String(
              form.get('requirements') ?? '',
            ).trim(),
            scopeCommitments: scopeCommitmentsFromForm(form),
            paymentRemark: String(
              form.get('paymentRemark') ?? '',
            ).trim(),
            termsConditions: String(
              form.get('termsConditions') ?? '',
            ).trim(),
            deliverables: splitValues(
              form.get('deliverables'),
            ),
            primaryContacts: splitValues(
              form.get('primaryContacts'),
            ),
          }),
        },
      );

      closeModal();
      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Client update failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateOnboarding = async (
    client: Client,
    stage: Exclude<
      ClientOnboardingStage,
      'DRAFT'
    >,
  ) => {
    let note: string | undefined;

    if (stage === 'APPROVED') {
      const confirmed = await appDialog.confirm({
        title: 'Approve client',
        message: `Approve ${client.companyName ?? client.name} and hand over to Accounts & Quotation?`,
        confirmLabel: 'Approve & hand over',
      });

      if (!confirmed) {
        return;
      }

      note =
        (
          await appDialog.prompt({
            title: 'Approval note',
            message: 'Add a note if needed.',
            placeholder: 'Approval note (optional)',
            multiline: true,
          })
        )?.trim() || undefined;
    }

    if (
      stage === 'REJECTED' ||
      stage === 'FOLLOW_UP'
    ) {
      note =
        (
          await appDialog.prompt({
            title:
              stage === 'REJECTED'
                ? 'Client not approved'
                : 'Follow-up note',
            message:
              stage === 'REJECTED'
                ? 'Add the reason or client feedback.'
                : 'Add a follow-up note if needed.',
            placeholder:
              stage === 'REJECTED'
                ? 'Reason / client feedback'
                : 'Follow-up note (optional)',
            multiline: true,
            required:
              stage === 'REJECTED',
          })
        )?.trim() || undefined;

      if (
        stage === 'REJECTED' &&
        !note
      ) {
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      await request<Client>(
        `/clients/${client.id}/onboarding`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stage,
            note,
          }),
        },
      );

      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Workflow update failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const manageApprovedClient = async (
    client: Client,
    action: 'APPROVE' | 'UNAPPROVE' | 'DISCUSS',
  ) => {
    let note: string | undefined;

    if (action === 'APPROVE') {
      const confirmed = await appDialog.confirm({
        title: 'Approve client',
        message: `Approve ${client.companyName ?? client.name}? Existing Accounts / project history will be preserved.`,
        confirmLabel: 'Approve',
      });
      if (!confirmed) return;

      note =
        (
          await appDialog.prompt({
            title: 'Approval note',
            placeholder: 'Approval note (optional)',
            multiline: true,
          })
        )?.trim() || undefined;
    } else {
      note =
        (
          await appDialog.prompt({
            title:
              action === 'UNAPPROVE'
                ? 'Unapprove client'
                : 'Discuss client',
            message:
              action === 'UNAPPROVE'
                ? 'Add the reason for withdrawing approval.'
                : 'Add the discussion / change note.',
            placeholder:
              action === 'UNAPPROVE'
                ? 'Reason for unapproval'
                : 'Discussion note',
            multiline: true,
            required: true,
          })
        )?.trim() || undefined;

      if (!note) return;
    }

    setSaving(true);
    setError('');

    try {
      await request<Client>(
        `/clients/${client.id}/manage-approval`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, note }),
        },
      );
      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to manage client approval.',
      );
    } finally {
      setSaving(false);
    }
  };

  const manageQuotationApproval = async (
    client: Client,
    action: 'APPROVE' | 'UNAPPROVE',
  ) => {
    let note: string | undefined;

    if (action === 'APPROVE') {
      const confirmed = await appDialog.confirm({
        title: 'Approve quotation',
        message: [
          `Client: ${client.companyName ?? client.name}`,
          `Quotation No: ${client.quotationNumber ?? '—'}`,
          `Amount: ${
            (client as any).quotationAmount != null
              ? `₹${Number((client as any).quotationAmount).toLocaleString('en-IN')}`
              : '—'
          }`,
          '',
          `Commercial Details: ${(client as any).quotationDetails || '—'}`,
          '',
          `Billing Details: ${(client as any).billingDetails || '—'}`,
          '',
          'Approve this quotation?',
        ].join('\n'),
        confirmLabel: 'Approve Quotation',
      });
      if (!confirmed) return;

      note =
        (await appDialog.prompt({
          title: 'Quotation approval note',
          placeholder: 'Optional note',
          multiline: true,
        }))?.trim() || undefined;
    } else {
      note =
        (await appDialog.prompt({
          title: 'Request quotation changes',
          message: 'Add the reason. Accounts will need to revise and submit again.',
          placeholder: 'Reason',
          multiline: true,
          required: true,
        }))?.trim() || undefined;
      if (!note) return;
    }

    setSaving(true);
    setError('');

    try {
      await request<Client>(`/clients/${client.id}/quotation-approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update quotation approval.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updateCommercialStage = async (
    client: Client,
    stage:
      | 'AWAITING_CLIENT_CONFIRMATION'
      | 'READY_FOR_CLIENT_SERVICING'
      | 'HANDED_TO_CLIENT_SERVICING',
  ) => {
    setSaving(true);
    setError('');

    try {
      await request<Client>(`/clients/${client.id}/accounts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update quotation workflow.',
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePaymentRemark = async (client: Client) => {
    const remark = await appDialog.prompt({
      title: 'Payment Remark',
      message: client.companyName ?? client.name,
      placeholder: 'Add payment / follow-up remark',
      defaultValue: client.paymentRemark ?? '',
      multiline: true,
    });

    if (remark === null) return;

    setSaving(true);
    setError('');

    try {
      await request<Client>(`/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRemark: remark.trim() }),
      });
      await loadClients();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update payment remark.',
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (
    client: Client,
  ) => {
    const confirmed = await appDialog.confirm({
      title: 'Delete client',
      message: `Delete "${client.name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      await request(
        `/clients/${client.id}`,
        {
          method: 'DELETE',
        },
      );
      await loadClients();
    } catch (err) {
      await appDialog.alert({
        title: 'Delete failed',
        message:
          err instanceof Error
            ? err.message
            : 'Delete failed.',
      });
    }
  };

  const viewQuotation = async (client: Client) => {
    const quotation = client as Client & {
      quotationAmount?: number | null;
      quotationDetails?: string | null;
      billingDetails?: string | null;
      quotationApprovalNote?: string | null;
    };

    await appDialog.alert({
      title: `Quotation ${client.quotationNumber ?? ''}`,
      message: [
        `Client: ${client.companyName ?? client.name}`,
        `Quotation No: ${client.quotationNumber ?? '—'}`,
        `Amount: ${
          quotation.quotationAmount != null
            ? `₹${Number(quotation.quotationAmount).toLocaleString('en-IN')}`
            : '—'
        }`,
        '',
        'Commercial Details:',
        quotation.quotationDetails || '—',
        '',
        'Billing Details:',
        quotation.billingDetails || '—',
        '',
        `Status: ${
          client.quotationApprovedAt
            ? 'Approved'
            : 'Pending Super Admin approval'
        }`,
        quotation.quotationApprovalNote
          ? `Approval Note: ${quotation.quotationApprovalNote}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  };
  const canEditClient = (
    client: Client,
  ) =>
    Boolean(workflowAccess?.canManageAll) ||
    (Boolean(workflowAccess?.canOnboard) &&
      (client.onboardingStage !== 'APPROVED' ||
        Boolean(workflowAccess?.canManageApprovedClient)));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Client Onboarding
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Business Development → Client Approval → Accounts & Quotation
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadClients()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {workflowAccess?.canOnboard && (
            <button
              onClick={() => setModal('create')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              New Client
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search clients..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm"
            />
          </div>

          <select
            value={onboardingStage}
            onChange={(event) =>
              setOnboardingStage(
                event.target.value,
              )
            }
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
          >
            <option value="">All Client Stages</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="CLIENT_APPROVAL">Client Approval</option>
            <option value="UNAPPROVED">Unapproved</option>
            <option value="QUOTATION">Quotation</option>
          </select>
        </div>

        {error && !modal && (
          <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">
                    Company / Brand
                  </th>
                  <th className="px-5 py-4">
                    BDM Owner
                  </th>
                  <th className="px-5 py-4">
                    Scope / Commitments
                  </th>
                  <th className="px-5 py-4">
                    Onboarding
                  </th>
                  <th className="px-5 py-4">
                    Action
                  </th>
                  <th className="px-5 py-4">
                    Manage
                  </th>
                  <th className="px-5 py-4">
                    Payment Remark
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="align-top hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {client.companyName ?? '—'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {client.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {client.phone ?? client.email ?? 'No contact added'}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      {client.accountManager?.fullName ?? '—'}
                    </td>

                    <td className="max-w-72 px-5 py-4">
                      <p className="line-clamp-3 text-xs leading-5 text-slate-600">
                        {client.requirements ?? 'Scope / commitments not added yet.'}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <OnboardingBadge
                        stage={client.onboardingStage}
                      />
                      {client.accountsHandoverAt && (
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          Accounts notified
                        </p>
                      )}
                    </td>

                    <td className="min-w-64 px-5 py-4">
                      {workflowAccess?.canOnboard ? (
                        <WorkflowActions
                          client={client}
                          saving={saving}
                          canManageApproved={Boolean(
                            workflowAccess?.canManageApprovedClient,
                          )}
                          isSuperAdmin={Boolean(workflowAccess?.isSuperAdmin)}
                          isBusinessDevelopment={Boolean(workflowAccess?.isBusinessDevelopment)}
                          onMove={(stage) =>
                            void updateOnboarding(
                              client,
                              stage,
                            )
                          }
                          onManage={(action) =>
                            void manageApprovedClient(
                              client,
                              action,
                            )
                          }
                          onQuotationApproval={(action) =>
                            void manageQuotationApproval(client, action)
                          }
                          onCommercialStage={(stage) =>
                            void updateCommercialStage(client, stage)
                          }
                        />
                      ) : (
                        <span className="text-xs text-slate-400">
                          Read only
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">

                        {workflowAccess?.canAccounts &&
                          client.onboardingStage === 'APPROVED' &&
                          client.accountsHandoverAt && (
                            <button
                              type="button"
                              onClick={() => {
                                window.location.href =
                                  '/manager/dashboard#accounts-workflow';
                              }}
                              className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                            >
                              {client.quotationNumber
                                ? 'Revise Quotation'
                                : 'Create Quotation'}
                            </button>
                          )}

                        {workflowAccess?.isSuperAdmin &&
                          client.accountsStage === 'QUOTATION_PREPARED' &&
                          client.quotationNumber && (
                            <button
                              type="button"
                              onClick={() => void viewQuotation(client)}
                              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100"
                            >
                              View Quotation
                            </button>
                          )}

                        {canEditClient(client) && (
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => {
                              setSelectedClient(client);
                              setModal('edit');
                            }}
                            className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={() =>
                              void deleteClient(client)
                            }
                            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="min-w-52 px-5 py-4">
                      <div className="flex items-start gap-2">
                        <p className="max-w-44 text-xs leading-5 text-slate-600">
                          {client.paymentRemark || '—'}
                        </p>
                        {workflowAccess?.canManageApprovedClient && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void updatePaymentRemark(client)}
                            className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Remark
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!clients.length && (
              <div className="p-12 text-center text-sm text-slate-400">
                No clients found.
              </div>
            )}
          </div>
        )}
      </div>

      {(modal === 'create' ||
        modal === 'edit') && (
        <ModalBox
          title={
            modal === 'create'
              ? 'New Client · Business Development'
              : 'Edit Client Onboarding'
          }
          error={error}
          onClose={closeModal}
        >
          <ClientForm
            client={
              modal === 'edit'
                ? selectedClient ?? undefined
                : undefined
            }
            saving={saving}
            onSubmit={
              modal === 'create'
                ? createClient
                : updateClient
            }
          />
        </ModalBox>
      )}
    </div>
  );
}

function WorkflowActions({
  client,
  saving,
  canManageApproved,
  isSuperAdmin,
  isBusinessDevelopment,
  onMove,
  onManage,
  onQuotationApproval,
  onCommercialStage,
}: {
  client: Client;
  saving: boolean;
  canManageApproved: boolean;
  isSuperAdmin: boolean;
  isBusinessDevelopment: boolean;
  onMove: (
    stage: Exclude<
      ClientOnboardingStage,
      'DRAFT'
    >,
  ) => void;
  onManage: (
    action: 'APPROVE' | 'UNAPPROVE' | 'DISCUSS',
  ) => void;
  onQuotationApproval: (
    action: 'APPROVE' | 'UNAPPROVE',
  ) => void;
  onCommercialStage: (
    stage:
      | 'AWAITING_CLIENT_CONFIRMATION'
      | 'READY_FOR_CLIENT_SERVICING'
      | 'HANDED_TO_CLIENT_SERVICING',
  ) => void;
}) {
  type ActionValue =
    | 'TERMS_SHARED'
    | 'AWAITING_CLIENT_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'FOLLOW_UP'
    | 'MANAGE_APPROVE'
    | 'MANAGE_UNAPPROVE'
    | 'MANAGE_DISCUSS'
    | 'QUOTATION_APPROVE'
    | 'QUOTATION_UNAPPROVE'
    | 'SEND_QUOTATION'
    | 'CLIENT_CONFIRMED'
    | 'HANDOVER_CLIENT_SERVICING';

  const options: Array<{
    value: ActionValue;
    label: string;
  }> = [];

  const readyForTerms = Boolean(
    client.requirements && client.termsConditions,
  );

  if (client.onboardingStage === 'DRAFT' && readyForTerms) {
    options.push({ value: 'TERMS_SHARED', label: 'T&C Shared' });
  }

  if (client.onboardingStage === 'TERMS_SHARED') {
    options.push({
      value: 'AWAITING_CLIENT_APPROVAL',
      label: 'Send for Client Approval',
    });
  }

  if (client.onboardingStage === 'AWAITING_CLIENT_APPROVAL') {
    if (isSuperAdmin) {
      options.push({ value: 'APPROVED', label: 'Final Approve Client' });
    }
    options.push({ value: 'REJECTED', label: 'Unapprove Client' });
    options.push({ value: 'FOLLOW_UP', label: 'Discuss / Follow-up' });
  }

  if (client.onboardingStage === 'REJECTED') {
    options.push({ value: 'FOLLOW_UP', label: 'Move to Discussion' });
  }

  if (client.onboardingStage === 'FOLLOW_UP' && readyForTerms) {
    options.push({ value: 'TERMS_SHARED', label: 'Re-share T&C' });
  }

  if (client.accountsHandoverAt && canManageApproved) {
    if (client.onboardingStage !== 'APPROVED' && isSuperAdmin) {
      options.push({ value: 'MANAGE_APPROVE', label: 'Approve Client' });
    }
    if (client.onboardingStage !== 'REJECTED') {
      options.push({ value: 'MANAGE_UNAPPROVE', label: 'Unapprove Client' });
    }
    if (client.onboardingStage !== 'FOLLOW_UP') {
      options.push({ value: 'MANAGE_DISCUSS', label: 'Discuss Client' });
    }
  }

  if (
    client.accountsStage === 'QUOTATION_PREPARED' &&
    isSuperAdmin
  ) {
    if (!client.quotationApprovedAt) {
      options.push({
        value: 'QUOTATION_APPROVE',
        label: 'Approve Quotation',
      });
    }

    options.push({
      value: 'QUOTATION_UNAPPROVE',
      label: 'Request Changes',
    });
  }

  const canHandleCommercial = isBusinessDevelopment || isSuperAdmin;

  if (
    canHandleCommercial &&
    client.accountsStage === 'QUOTATION_PREPARED' &&
    client.quotationApprovedAt
  ) {
    options.push({ value: 'SEND_QUOTATION', label: 'Quotation Sent to Client' });
  }

  if (
    canHandleCommercial &&
    client.accountsStage === 'AWAITING_CLIENT_CONFIRMATION'
  ) {
    options.push({ value: 'CLIENT_CONFIRMED', label: 'Client Confirmed' });
  }

  if (
    canHandleCommercial &&
    client.accountsStage === 'READY_FOR_CLIENT_SERVICING'
  ) {
    options.push({
      value: 'HANDOVER_CLIENT_SERVICING',
      label: 'Hand Over to Client Servicing',
    });
  }

  const statusLabel = client.accountsStage
    ? client.accountsStage === 'QUOTATION_PREPARED'
      ? client.quotationApprovedAt
        ? 'Quotation Approved'
        : 'Quotation Pending Approval'
      : client.accountsStage === 'AWAITING_CLIENT_CONFIRMATION'
        ? 'Awaiting Client Confirmation'
        : client.accountsStage === 'READY_FOR_CLIENT_SERVICING'
          ? 'Ready for Client Servicing'
          : client.accountsStage === 'HANDED_TO_CLIENT_SERVICING'
            ? 'Handed to Client Servicing'
            : 'Accounts Handover'
    : client.onboardingStage === 'AWAITING_CLIENT_APPROVAL'
      ? 'Client Approval Pending'
      : client.onboardingStage.replaceAll('_', ' ');

  if (!options.length) {
    return (
      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
        {statusLabel}
      </span>
    );
  }

  return (
    <select
      defaultValue=""
      disabled={saving}
      onChange={(event) => {
        const action = event.target.value as ActionValue;
        event.currentTarget.value = '';

        if (!action) return;

        if (
          action === 'TERMS_SHARED' ||
          action === 'AWAITING_CLIENT_APPROVAL' ||
          action === 'APPROVED' ||
          action === 'REJECTED' ||
          action === 'FOLLOW_UP'
        ) {
          onMove(action);
          return;
        }

        if (action === 'MANAGE_APPROVE') onManage('APPROVE');
        if (action === 'MANAGE_UNAPPROVE') onManage('UNAPPROVE');
        if (action === 'MANAGE_DISCUSS') onManage('DISCUSS');
        if (action === 'QUOTATION_APPROVE') onQuotationApproval('APPROVE');
        if (action === 'QUOTATION_UNAPPROVE') onQuotationApproval('UNAPPROVE');
        if (action === 'SEND_QUOTATION') {
          onCommercialStage('AWAITING_CLIENT_CONFIRMATION');
        }
        if (action === 'CLIENT_CONFIRMED') {
          onCommercialStage('READY_FOR_CLIENT_SERVICING');
        }
        if (action === 'HANDOVER_CLIENT_SERVICING') {
          onCommercialStage('HANDED_TO_CLIENT_SERVICING');
        }
      }}
      className="min-w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:bg-slate-50 disabled:opacity-50"
    >
      <option value="">Manage · {statusLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}


function ClientForm({
  client,
  saving,
  onSubmit,
}: {
  client?: Client;
  saving: boolean;
  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 sm:grid-cols-2"
    >
      <Input
        name="companyName"
        label="Company Name"
        required
        defaultValue={client?.companyName ?? ''}
      />

      <Input
        name="brandName"
        label="Brand Name"
        required
        defaultValue={client?.name ?? ''}
      />

      <Input
        name="phone"
        label="Phone Number"
        defaultValue={client?.phone ?? ''}
      />

      <Input
        name="email"
        label="Email"
        type="email"
        defaultValue={client?.email ?? ''}
      />

      <div className="sm:col-span-2">
        <Textarea
          name="requirements"
          label="Client Scope of Work / Commitments"
          helper="Main agreed scope, commitments and client expectations"
          rows={2}
          defaultValue={client?.requirements ?? ''}
        />
      </div>

      <div className="sm:col-span-2">
        <ScopeCommitmentsEditor value={client?.scopeCommitments ?? null} />
      </div>

      <details className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700">
          More details
        </summary>
        <div className="grid gap-3 border-t border-slate-200 p-4 sm:grid-cols-2">
          <Textarea
            name="primaryContacts"
            label="Primary Contacts"
            helper="One contact per line or comma separated"
            rows={2}
            defaultValue={client?.primaryContacts?.join('\n') ?? ''}
          />

          <Textarea
            name="deliverables"
            label="Expected Deliverables"
            helper="One deliverable per line"
            rows={2}
            defaultValue={client?.deliverables?.join('\n') ?? ''}
          />

          <div className="sm:col-span-2">
            <Textarea
              name="termsConditions"
              label="Terms & Conditions"
              helper="Commercial / working terms"
              rows={2}
              defaultValue={client?.termsConditions ?? ''}
            />
          </div>

          {client && (
            <div className="sm:col-span-2">
              <Textarea
                name="paymentRemark"
                label="Payment Remark"
                helper="Payment status / follow-up note"
                rows={2}
                defaultValue={client.paymentRemark ?? ''}
              />
            </div>
          )}
        </div>
      </details>

      <div className="sm:col-span-2">
        <button
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {client
            ? 'Save Client Details'
            : 'Create Client Draft'}
        </button>
      </div>
    </form>
  );
}

function ScopeCommitmentsEditor({
  value,
}: {
  value: ScopeCommitments | null;
}) {
  const initialColumns =
    value?.columns?.length
      ? value.columns
      : ['Particular / Description', 'Sub Description'];

  const initialRows =
    value?.rows?.length
      ? value.rows.map((row) => [
          ...row,
          ...Array(Math.max(0, initialColumns.length - row.length)).fill(''),
        ].slice(0, initialColumns.length))
      : Array.from({ length: 3 }, () =>
          Array(initialColumns.length).fill(''),
        );

  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [rows, setRows] = useState<string[][]>(initialRows);

  const updateColumn = (index: number, label: string) => {
    setColumns((current) =>
      current.map((column, columnIndex) =>
        columnIndex === index ? label : column,
      ),
    );
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    setRows((current) =>
      current.map((row, currentRowIndex) =>
        currentRowIndex === rowIndex
          ? row.map((cell, currentColumnIndex) =>
              currentColumnIndex === columnIndex ? value : cell,
            )
          : row,
      ),
    );
  };

  const addRow = () => {
    setRows((current) => [
      ...current,
      Array(columns.length).fill(''),
    ]);
  };

  const addColumn = () => {
    const nextLabel = `Additional ${columns.length - 1}`;
    setColumns((current) => [...current, nextLabel]);
    setRows((current) => current.map((row) => [...row, '']));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">
            Scope / Commitment Table
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Starts with 3 rows. Add rows or columns whenever needed.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            + Add New Row
          </button>
          <button
            type="button"
            onClick={addColumn}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            + Add Column
          </button>
        </div>
      </div>

      <input
        type="hidden"
        name="scopeCommitmentsJson"
        value={JSON.stringify({ columns, rows })}
        readOnly
      />

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="w-14 border border-slate-200 bg-slate-50 px-2 py-2 text-left font-bold text-slate-600">
                Sr.
              </th>
              {columns.map((column, index) => (
                <th
                  key={`scope-head-${index}`}
                  className="min-w-52 border border-l-0 border-slate-200 bg-slate-50 p-1.5"
                >
                  <input
                    value={column}
                    onChange={(event) => updateColumn(index, event.target.value)}
                    aria-label={`Scope column ${index + 1}`}
                    className="w-full bg-transparent px-1 py-1 font-bold text-slate-600 outline-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`scope-row-${rowIndex}`}>
                <td className="border border-t-0 border-slate-200 px-2 py-2 font-bold text-slate-500">
                  {rowIndex + 1}
                </td>
                {columns.map((_, columnIndex) => (
                  <td
                    key={`scope-cell-${rowIndex}-${columnIndex}`}
                    className="border border-l-0 border-t-0 border-slate-200 p-1.5"
                  >
                    <input
                      value={row[columnIndex] ?? ''}
                      onChange={(event) =>
                        updateCell(rowIndex, columnIndex, event.target.value)
                      }
                      className="w-full min-w-44 rounded-md border-0 px-1.5 py-1.5 text-xs outline-none focus:bg-slate-50"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
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
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-slate-400"
      />
    </label>
  );
}

function Textarea({
  name,
  label,
  helper,
  defaultValue,
  rows = 2,
}: {
  name: string;
  label: string;
  helper?: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">
        {label}
      </span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
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
      {helper && (
        <span className="mt-1 block text-[11px] leading-4 text-slate-400">
          {helper}
        </span>
      )}
    </label>
  );
}

function OnboardingBadge({
  stage,
}: {
  stage: ClientOnboardingStage;
}) {
  const styles: Record<
    ClientOnboardingStage,
    string
  > = {
    DRAFT: 'bg-slate-100 text-slate-700',
    TERMS_SHARED: 'bg-blue-50 text-blue-700',
    AWAITING_CLIENT_APPROVAL:
      'bg-amber-50 text-amber-700',
    APPROVED:
      'bg-emerald-50 text-emerald-700',
    REJECTED: 'bg-red-50 text-red-700',
    FOLLOW_UP:
      'bg-violet-50 text-violet-700',
  };

  const labels: Record<
    ClientOnboardingStage,
    string
  > = {
    DRAFT: 'Draft',
    TERMS_SHARED: 'T&C Shared',
    AWAITING_CLIENT_APPROVAL:
      'Awaiting Client Approval',
    APPROVED: 'Approved',
    REJECTED: 'Not Approved',
    FOLLOW_UP: 'Follow-up',
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[stage]}`}
    >
      {labels[stage]}
    </span>
  );
}
