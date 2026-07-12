// Updates a member's editable biodata. Prognosis exposes two separate
// endpoints depending on whether the record is the principal (main member)
// or a dependant (beneficiary):
//   - Principal → EnrolleeProfile/UpdateBiodata — Photo, Phone, Email, DOB, Address
//   - Dependant → EnrolleeProfile/UpdateBeneficiary — Gender, DOB, Phone, Email
// Both replace the whole record rather than patching individual fields, so we
// first fetch the member's current full record and only override the
// HR-editable fields on top of it — everything else is passed through
// unchanged to avoid accidentally blanking data Prognosis already has.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { cacheBust } from '@/lib/server-cache';
import { logAudit } from '@/lib/audit';

const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${BASE}/api/ApiUsers/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ Username: process.env.PROGNOSIS_USERNAME, Password: process.env.PROGNOSIS_PASSWORD }),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try { data = JSON.parse(text); } catch {
    throw new Error(`Service login non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  const payload = (data?.data ?? data?.Data ?? data?.result ?? data?.Result ?? data) as Record<string, unknown>;
  const token = String(
    payload?.accessToken ?? payload?.token ?? payload?.AccessToken ?? payload?.Token ??
    payload?.bearer ?? payload?.Bearer ?? payload?.bearerToken ?? payload?.BearerToken ?? ''
  );
  if (!token) throw new Error('No token from ApiUsers/Login');
  cachedToken = token;
  tokenExpiry = Date.now() + 6 * 60 * 60 * 1000;
  return token;
}

export interface UpdateInfoPayload {
  enrolleeId: string;
  cifNumber?: string | number;
  isPrincipal?: boolean;
  sexId?: string;        // "1" Male, "2" Female — dependants only
  dateOfBirth?: string;
  mobile?: string;
  email?: string;
  address?: string;      // principals only
  photo?: string;         // base64 — principals only
  photoType?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  let body: UpdateInfoPayload;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { enrolleeId, isPrincipal, sexId, dateOfBirth, mobile, email, address, photo, photoType } = body;
  if (!enrolleeId) return NextResponse.json({ error: 'enrolleeId is required' }, { status: 400 });
  const hasChange = isPrincipal
    ? Boolean(dateOfBirth || mobile || email || address || photo)
    : Boolean(sexId || dateOfBirth || mobile || email);
  if (!hasChange) {
    return NextResponse.json({ error: 'Change at least one field.' }, { status: 400 });
  }

  const groupId = session.user.companyId ?? '';

  try {
    const token = await getServiceToken();

    // Fetch the member's current full record so we can preserve every field
    // Prognosis isn't letting HR edit here.
    const profileRes = await fetch(
      `${BASE}/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const profileText = await profileRes.text();
    let profileRaw: unknown;
    try { profileRaw = JSON.parse(profileText); } catch { profileRaw = null; }
    if (!profileRes.ok || !profileRaw) {
      return NextResponse.json({ error: `Could not load current member record (${profileRes.status})` }, { status: 502 });
    }
    const p = profileRaw as Record<string, unknown>;
    // GetEnrolleeBioDataByEnrolleeID's "result" is an array — the row itself
    // is result[0], not the array. Spreading the array directly (as before)
    // put numeric-index keys into the payload instead of real field names,
    // so Prognosis received a payload missing Cif_Number/scheme/NIN entirely
    // and rejected the whole record as invalid.
    const resultField = p?.result ?? p?.Result ?? p?.data ?? p?.Data;
    const row = ((Array.isArray(resultField) ? resultField[0] : resultField) ?? p ?? {}) as Record<string, unknown>;

    const cifNumber = body.cifNumber ?? row['Cif_Number'] ?? row['CIF_Number'] ?? row['CifNo'] ?? row['Cif'] ?? row['cifNumber'];

    const payload: Record<string, unknown> = {
      ...row,
      groupid: Number(groupId) || groupId || row['groupid'] || row['GroupId'] || 0,
      Cif_number: Number(cifNumber) || cifNumber || 0,
      ...(dateOfBirth ? { DateOfBirth: dateOfBirth } : {}),
      ...(mobile ? { Mobile: mobile } : {}),
      ...(email ? { EmailAdress: email } : {}),
      ...(isPrincipal
        ? {
            ...(address ? { Physical_Add1: address } : {}),
            ...(photo ? { EnrolleePicture: photo, EnrolleePictureType: photoType || 'image/jpeg' } : {}),
          }
        : { ...(sexId ? { Sex_ID: sexId } : {}) }),
    };

    const endpoint = isPrincipal ? 'UpdateBiodata' : 'UpdateBeneficiary';
    const res = await fetch(`${BASE}/api/EnrolleeProfile/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`[hr/members/update-info] ${endpoint} HTTP ${res.status}: ${text.slice(0, 500)}`);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    if (!res.ok) {
      const msg = r?.Message ?? r?.message ?? r?.error ?? r?.Error ?? text.slice(0, 300);
      return NextResponse.json({ error: String(msg) }, { status: res.status });
    }

    const apiStatus = String(r?.status ?? r?.Status ?? '').toLowerCase();
    // On failure Prognosis returns its message as a `result` array of
    // { Text: "..." } validation entries rather than a single message field.
    const resultErrors = Array.isArray(r?.result)
      ? (r.result as Array<{ Text?: string }>).map((e) => e?.Text).filter(Boolean).join('; ')
      : '';
    const apiMessage = String(r?.message ?? r?.Message ?? '') || resultErrors;
    if (apiStatus && apiStatus !== 'success' && apiStatus !== '200') {
      return NextResponse.json({ error: apiMessage || `Update failed (${apiStatus})` }, { status: 422 });
    }

    if (groupId) cacheBust(`members-${groupId}`);

    void logAudit({ session, action: 'UPDATE_MEMBER_INFO', resource: 'members', request: req,
      details: { enrolleeId, cifNumber, isPrincipal, changed: { sexId: !!sexId, dateOfBirth: !!dateOfBirth, mobile: !!mobile, email: !!email, address: !!address, photo: !!photo } } });

    return NextResponse.json({ success: true, message: apiMessage || 'Member updated successfully.' });
  } catch (err) {
    console.error('[hr/members/update-info] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update member' }, { status: 500 });
  }
}
