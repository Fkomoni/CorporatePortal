export type ClaimsVisibility = {
  showSummaryCards: boolean;
  showAmounts:      boolean;
  showExports:      boolean;
  showFilters:      boolean;
  showTable:        boolean;
};

export const DEFAULT_CLAIMS_VISIBILITY: ClaimsVisibility = {
  showSummaryCards: true,
  showAmounts:      true,
  showExports:      true,
  showFilters:      true,
  showTable:        true,
};

const KEY = 'lh_claims_visibility';

export function getClaimsVisibility(): ClaimsVisibility {
  if (typeof window === 'undefined') return DEFAULT_CLAIMS_VISIBILITY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CLAIMS_VISIBILITY;
    return { ...DEFAULT_CLAIMS_VISIBILITY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CLAIMS_VISIBILITY;
  }
}

export function saveClaimsVisibility(v: ClaimsVisibility): void {
  localStorage.setItem(KEY, JSON.stringify(v));
}
