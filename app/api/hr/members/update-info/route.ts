// Updates a member's editable biodata. Prognosis exposes two separate
// endpoints depending on whether the record is the principal (main member)
// or a dependant (beneficiary):
//   - Principal → EnrolleeProfile/UpdateBiodata. Photo, Phone, Email, DOB, Address
//   - Dependant → EnrolleeProfile/UpdateBeneficiary. Gender, DOB, Phone, Email
// Both replace the whole record rather than patching individual fields, so we
// first fetch the member's current full record and only override the
// HR-editable fields on top of it: everything else is passed through
// unchanged to avoid accidentally blanking data Prognosis already has.
import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { cacheBust } from '@/lib/server-cache';
import { logAudit } from '@/lib/audit';
import { sexIdFromText } from '@/lib/gender';
import { validateMobile, normalizeNigerianMobile as normalizePhone } from '@/lib/phone';
import { validateEmail, normalizeEmail } from '@/lib/email';
import { getPrincipalRelationshipId } from '@/lib/principal-relationship';
import { buildMemberWritePayload, s, n } from '@/lib/member-write-payload';

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
  sexId?: string;        // Prognosis Sex_ID. See lib/gender.ts (1 = Male, 2 = Female)
  dateOfBirth?: string;
  mobile?: string;
  email?: string;
  address?: string;      // principals only
  photo?: string;         // base64, principals only
  photoType?: string;
  nin?: string;           // 11-digit NIN, Prognosis requires this on every save, even if unrelated fields are the only ones changing
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

  const { enrolleeId, isPrincipal, sexId, dateOfBirth, mobile, email, address, photo, photoType, nin } = body;
  if (!enrolleeId) return NextResponse.json({ error: 'enrolleeId is required' }, { status: 400 });
  const contactErr = validateEmail(email, { label: 'Email' })
    ?? validateMobile(mobile, { label: 'Mobile number' });
  if (contactErr) return NextResponse.json({ error: contactErr }, { status: 400 });
  if (nin && !/^\d{11}$/.test(nin)) {
    return NextResponse.json({ error: 'NIN must be exactly 11 digits.' }, { status: 400 });
  }
  const hasChange = isPrincipal
    ? Boolean(sexId || dateOfBirth || mobile || email || address || photo || nin)
    : Boolean(sexId || dateOfBirth || mobile || email || nin);
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
    // GetEnrolleeBioDataByEnrolleeID's "result" is an array: the row itself
    // is result[0], not the array. Spreading the array directly (as before)
    // put numeric-index keys into the payload instead of real field names,
    // so Prognosis received a payload missing Cif_Number/scheme/NIN entirely
    // and rejected the whole record as invalid.
    const resultField = p?.result ?? p?.Result ?? p?.data ?? p?.Data;
    const row = ((Array.isArray(resultField) ? resultField[0] : resultField) ?? p ?? {}) as Record<string, unknown>;

    const cifNumber = body.cifNumber ?? row['Member_MemberUniqueID'] ?? row['Cif_Number'] ?? row['CIF_Number'] ?? row['CifNo'] ?? row['Cif'] ?? row['cifNumber'];
    // Strip a "data:image/...;base64," prefix if the client sent a full data
    // URI. Prognosis wants raw base64 only.
    const rawPhoto = photo ? photo.replace(/^data:[^;]+;base64,/, '') : '';

    // UpdateBiodata/UpdateBeneficiary is a full-record replace, not a patch -
    // every field below must be sent. We read the member's current bio and
    // map every field onto this write shape unchanged, then overlay only the
    // 1-2 fields HR actually edited on top.
    // Built by the shared writer so the relationship repair produces identical
    // records. Relationship_ID is the only field whose behaviour changed: a
    // principal is now written as the main member instead of falling through to
    // 41 (Other) or a blank.
    const mainMemberId = await getPrincipalRelationshipId(token);
    const payload = buildMemberWritePayload({
      row, enrolleeId, groupId, cifNumber, isPrincipal: !!isPrincipal, mainMemberId,
      overrides: { dateOfBirth, sexId, email, mobile, address, nin, photo: rawPhoto, photoType },
    });

    const endpoint = isPrincipal ? 'UpdateBiodata' : 'UpdateBeneficiary';
    console.log(`[hr/members/update-info] ${endpoint} payload: ${JSON.stringify({ ...payload, EnrolleePicture: payload.EnrolleePicture ? `<${String(payload.EnrolleePicture).length} chars>` : '' })}`);
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

    // Prognosis routinely returns HTTP 200 on a business-logic failure, so
    // res.ok alone is meaningless here: inspect the body. The error text can
    // land under any of several keys depending on which code path was hit.
    function extractErrorText(v: unknown): string {
      if (v == null) return '';
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v.map(extractErrorText).filter(Boolean).join('; ');
      if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return String(o.Text ?? o.text ?? o.Message ?? o.message ?? o.ErrorMessage ?? o.errorMessage ?? '');
      }
      return '';
    }
    const statusVal = r?.status ?? r?.Status;
    const statusNum = Number(statusVal);
    const statusStr = String(statusVal ?? '').toLowerCase();
    const isFailureStatus = statusVal !== undefined && (
      (Number.isFinite(statusNum) && (statusNum < 200 || statusNum >= 300))
      || (!Number.isFinite(statusNum) && !['success', 'true', 'ok'].includes(statusStr))
    );
    const isExplicitFailure = r?.success === false || r?.Success === false
      || ((r?.result === null || r?.Result === null) && Boolean(r?.Message ?? r?.message));
    const resultErrors = extractErrorText(r?.result) || extractErrorText(r?.Result);
    const topErrors = String(r?.Message ?? r?.message ?? r?.error ?? r?.Error ?? '');
    const apiMessage = topErrors || resultErrors;

    if (!res.ok || isFailureStatus || isExplicitFailure) {
      return NextResponse.json({ error: apiMessage || `Update failed (${res.status})` }, { status: res.ok ? 422 : res.status });
    }

    if (groupId) cacheBust(`members-${groupId}`);

    void logAudit({ session, action: 'UPDATE_MEMBER_INFO', resource: 'members', request: req,
      details: { enrolleeId, cifNumber, isPrincipal, changed: { sexId: !!sexId, dateOfBirth: !!dateOfBirth, mobile: !!mobile, email: !!email, address: !!address, photo: !!photo, nin: !!nin } } });

    return NextResponse.json({ success: true, message: apiMessage || 'Member updated successfully.' });
  } catch (err) {
    console.error('[hr/members/update-info] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update member' }, { status: 500 });
  }
}
