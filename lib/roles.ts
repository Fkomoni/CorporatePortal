// Role helpers shared by UI and API routes.
// "Admin" covers the primary HR account (hr_admin) and users invited with
// the built-in Admin role.
export function isAdminRole(role?: string | null): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'hr_admin' || r === 'admin';
}

//  Per-role module access
// Matches the access descriptions shown on the Administration page's role
// cards ("Finance module & Finance Reports only", etc). Invited users' role
// is free text (e.g. "Finance Manager"), so we match by keyword rather than
// an exact string: anything containing "finance" gets Finance-only access,
// anything containing "hr" gets the HR Manager set, everything else (Admin,
// Viewer, or an unrecognised role) defaults to full access.
export type ModuleKey =
  | 'dashboard' | 'members' | 'benefits' | 'finance' | 'claims'
  | 'reports' | 'serviceDesk' | 'wellness' | 'preEmployment';

const HR_MANAGER_MODULES: ModuleKey[] = [
  'dashboard', 'members', 'benefits', 'reports', 'serviceDesk',
];

const FINANCE_MODULES: ModuleKey[] = ['dashboard', 'finance', 'reports'];

export function roleModuleAccess(role?: string | null): ModuleKey[] | 'all' {
  const r = (role ?? '').trim().toLowerCase();
  if (isAdminRole(r)) return 'all';
  if (r.includes('finance')) return FINANCE_MODULES;
  if (r.includes('hr') || r.includes('manager')) return HR_MANAGER_MODULES;
  return 'all';
}

export function canAccessModule(role: string | null | undefined, module: ModuleKey): boolean {
  const access = roleModuleAccess(role);
  return access === 'all' || access.includes(module);
}

// Maps a portal pathname to the module it belongs to. Returns null for
// pathnames that aren't module-gated (e.g. /administration, /audit-logs -
// those are already restricted separately via isAdminRole).
export function moduleForPath(pathname: string): ModuleKey | null {
  const seg = pathname.split('/').filter(Boolean)[0] ?? '';
  switch (seg) {
    case 'dashboard': return 'dashboard';
    case 'members':
    case 'pending-enrolees': return 'members';
    case 'benefits': return 'benefits';
    case 'finance': return 'finance';
    case 'claims': return 'claims';
    case 'reports': return 'reports';
    case 'service-desk': return 'serviceDesk';
    case 'wellness': return 'wellness';
    case 'pre-employment': return 'preEmployment';
    default: return null;
  }
}
