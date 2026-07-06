// Role helpers shared by UI and API routes.
// "Admin" covers the primary HR account (hr_admin) and users invited with
// the built-in Admin role.
export function isAdminRole(role?: string | null): boolean {
  const r = (role ?? '').trim().toLowerCase();
  return r === 'hr_admin' || r === 'admin';
}
