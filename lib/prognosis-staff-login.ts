// Validates a Leadway staff member's login against Prognosis, which in turn
// checks Leadway's Active Directory — the AD password is the only password
// that ever exists for internal admins; we never set or store one locally.
//
// Contract confirmed by the user directly (from another app that already
// uses this correctly):
//   POST /api/Account/ExternalPortalLogin
//   Authorization: Basic base64(PROGNOSIS_USERNAME:PROGNOSIS_PASSWORD)  ← service creds
//   { UserName, Email, Password, LogInSource: "Core" }
// Valid only when: HTTP 2xx, body status isn't false/error/fail/failed, and
// result[] is a non-empty array (the user record is result[0]).
const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

function serviceAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${process.env.PROGNOSIS_USERNAME}:${process.env.PROGNOSIS_PASSWORD}`).toString('base64');
}

export interface StaffLoginResult {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'medical_director' | 'supervisor' | 'officer';
  raw: Record<string, unknown>;
}

function mapRole(raw: unknown): StaffLoginResult['role'] {
  const r = String(raw ?? '').toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('medical director') || r.includes('physician')) return 'medical_director';
  if (r.includes('supervisor') || r.includes('manager') || r.includes('team lead')) return 'supervisor';
  return 'officer';
}

export async function staffLogin(login: string, password: string): Promise<StaffLoginResult | null> {
  const url = `${BASE}/api/Account/ExternalPortalLogin`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: serviceAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ UserName: login, Email: login, Password: password, LogInSource: 'Core' }),
  });

  const text = await res.text();
  console.log(`[prognosis-staff-login] login=${login} → HTTP ${res.status}: ${text.slice(0, 500)}`);

  if (res.status >= 500) throw new Error(`Prognosis unavailable (${res.status})`);
  if (res.status >= 400) return null;

  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch { return null; }

  if ([false, 'error', 'fail', 'failed'].includes(data?.status as false | string)) return null;

  const result = Array.isArray(data?.result) ? data.result : null;
  const user = result && result.length > 0 ? result[0] as Record<string, unknown> : null;
  if (!user) return null;

  delete user.PasswordHash;
  delete user.SecurityStamp;

  const emailRaw = user.email ?? user.Email ?? user.EmailAddress ?? login;
  const idRaw = user.id ?? user.Id ?? user.userId ?? user.UserId ?? login;
  const nameRaw = user.name ?? user.Name ?? user.FullName ?? user.fullName ?? login;
  const roleRaw = user.role ?? user.Role ?? user.RoleName ?? user.roleName;

  return {
    id: String(idRaw),
    email: String(emailRaw),
    name: String(nameRaw),
    role: mapRole(roleRaw),
    raw: user,
  };
}
