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

export const DEFAULTS = {
  dashboard: {
    showKpiCards: true, showAmounts: true, showActionCentre: true,
    showLossRatio: true, showSpendChart: true, showTopProviders: true,
    showTopConditions: true, showHealthInsights: true,
  } satisfies DashboardVis,

  claims: {
    showSummaryCards: true, showAmounts: true, showExports: true,
    showFilters: true, showTable: true,
  } satisfies ClaimsVis,

  finance: {
    showSummaryCards: true, showAmounts: true, showPaymentTimeline: true,
    showInvoiceTable: true, showDownloads: true, showReceiptsTab: true,
    showStatementTab: true,
  } satisfies FinanceVis,

  benefits: {
    showBenefitPlans: true, showProviderSearch: true,
  } satisfies BenefitsVis,

  people: {
    showSummaryCards: true, showAddMember: true, showBeneficiaryView: true,
    showEnroleeIds: true, showTerminateAction: true,
  } satisfies PeopleVis,

  reports: {
    showMembershipReport: true, showUtilizationReport: true,
    showClaimsAnalysis: true, showProviderUtilization: true,
    showFinancialReport: true, showExports: true,
  } satisfies ReportsVis,

  serviceDesk: {
    showSummaryCards: true, showTicketTable: true,
    showNewRequest: true, showSlaColumn: true,
  } satisfies ServiceDeskVis,
};

export type ModuleKey = keyof typeof DEFAULTS;

// ── Storage helpers ───────────────────────────────────────────────────────────

function storageKey(module: ModuleKey) { return `lh_vis_${module}`; }

export function getVis<K extends ModuleKey>(module: K): typeof DEFAULTS[K] {
  if (typeof window === 'undefined') return DEFAULTS[module];
  try {
    const raw = localStorage.getItem(storageKey(module));
    if (!raw) return DEFAULTS[module];
    return { ...DEFAULTS[module], ...JSON.parse(raw) };
  } catch {
    return DEFAULTS[module];
  }
}

export function saveVis<K extends ModuleKey>(module: K, v: typeof DEFAULTS[K]): void {
  localStorage.setItem(storageKey(module), JSON.stringify(v));
}

// ── Back-compat re-exports for claims page ────────────────────────────────────

export type ClaimsVisibility = ClaimsVis;
export const DEFAULT_CLAIMS_VISIBILITY = DEFAULTS.claims;
export const getClaimsVisibility  = () => getVis('claims');
export const saveClaimsVisibility = (v: ClaimsVis) => saveVis('claims', v);
