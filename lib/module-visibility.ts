// ── Per-module visibility types ──────────────────────────────────────────────

export type DashboardVis = {
  showKpiCards:       boolean; // 4 KPI stat cards
  showAmounts:        boolean; // financial figures (₦)
  showActionCentre:   boolean; // Action Centre widget
  showLossRatio:      boolean; // Loss Ratio section
  showSpendChart:     boolean; // Monthly spend chart
  showTopProviders:   boolean; // Top providers list
  showTopConditions:  boolean; // Top conditions list
  showHealthInsights: boolean; // AI health insights
};

export type ClaimsVis = {
  showSummaryCards: boolean; // 4 stat cards
  showAmounts:      boolean; // ₦ values
  showExports:      boolean; // XLS/PDF buttons
  showFilters:      boolean; // filter toolbar
  showTable:        boolean; // claims register table
};

export type FinanceVis = {
  showSummaryCards:    boolean; // 3 stat cards
  showAmounts:         boolean; // ₦ values
  showPaymentTimeline: boolean; // payment steps widget
  showInvoiceTable:    boolean; // invoice list
  showDownloads:       boolean; // per-row XLS/PDF
  showReceiptsTab:     boolean; // Receipts tab
  showStatementTab:    boolean; // Statement tab
};

export type BenefitsVis = {
  showBenefitPlans:   boolean; // Benefit Plans tab
  showProviderSearch: boolean; // Provider Search tab
};

export type PeopleVis = {
  showSummaryCards:    boolean; // 3 summary cards
  showAddMember:       boolean; // Add Member button
  showBeneficiaryView: boolean; // All Beneficiaries toggle
  showEnroleeIds:      boolean; // Enrolee ID column in table
  showTerminateAction: boolean; // Terminate button in Member 360
};

export type ReportsVis = {
  showMembershipReport:    boolean;
  showUtilizationReport:   boolean;
  showClaimsAnalysis:      boolean;
  showProviderUtilization: boolean;
  showFinancialReport:     boolean;
  showExports:             boolean; // XLS/PDF buttons
};

export type ServiceDeskVis = {
  showSummaryCards: boolean; // status count cards
  showTicketTable:  boolean; // ticket list
  showNewRequest:   boolean; // New Request button
  showSlaColumn:    boolean; // SLA column
};

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS: {
  dashboard:   DashboardVis;
  claims:      ClaimsVis;
  finance:     FinanceVis;
  benefits:    BenefitsVis;
  people:      PeopleVis;
  reports:     ReportsVis;
  serviceDesk: ServiceDeskVis;
} = {
  dashboard: {
    showKpiCards: true, showAmounts: true, showActionCentre: true,
    showLossRatio: true, showSpendChart: true, showTopProviders: true,
    showTopConditions: true, showHealthInsights: true,
  },

  claims: {
    showSummaryCards: true, showAmounts: true, showExports: true,
    showFilters: true, showTable: true,
  },

  finance: {
    showSummaryCards: true, showAmounts: true, showPaymentTimeline: true,
    showInvoiceTable: true, showDownloads: true, showReceiptsTab: true,
    showStatementTab: true,
  },

  benefits: {
    showBenefitPlans: true, showProviderSearch: true,
  },

  people: {
    showSummaryCards: true, showAddMember: true, showBeneficiaryView: true,
    showEnroleeIds: true, showTerminateAction: true,
  },

  reports: {
    showMembershipReport: true, showUtilizationReport: true,
    showClaimsAnalysis: true, showProviderUtilization: true,
    showFinancialReport: true, showExports: true,
  },

  serviceDesk: {
    showSummaryCards: true, showTicketTable: true,
    showNewRequest: true, showSlaColumn: true,
  },
};

export type ModuleKey = keyof typeof DEFAULTS;

// ── Storage helpers ───────────────────────────────────────────────────────────

const DEFAULT_COMPANY_ID = 'corp-001';

function getActiveCompanyId(): string {
  if (typeof window === 'undefined') return DEFAULT_COMPANY_ID;
  return localStorage.getItem('lh_active_company') ?? DEFAULT_COMPANY_ID;
}

function storageKey(module: ModuleKey, companyId: string) {
  return `lh_vis_${companyId}_${module}`;
}

export function getVis<K extends ModuleKey>(module: K, companyId?: string): typeof DEFAULTS[K] {
  const cid = companyId ?? getActiveCompanyId();
  if (typeof window === 'undefined') return DEFAULTS[module];
  try {
    const raw = localStorage.getItem(storageKey(module, cid));
    if (!raw) return DEFAULTS[module];
    return { ...DEFAULTS[module], ...JSON.parse(raw) };
  } catch {
    return DEFAULTS[module];
  }
}

export function saveVis<K extends ModuleKey>(module: K, v: typeof DEFAULTS[K], companyId?: string): void {
  const cid = companyId ?? getActiveCompanyId();
  localStorage.setItem(storageKey(module, cid), JSON.stringify(v));
}

// ── Back-compat re-exports for claims page ────────────────────────────────────

export type ClaimsVisibility = ClaimsVis;
export const DEFAULT_CLAIMS_VISIBILITY = DEFAULTS.claims;
export const getClaimsVisibility  = () => getVis('claims');
export const saveClaimsVisibility = (v: ClaimsVis) => saveVis('claims', v);
