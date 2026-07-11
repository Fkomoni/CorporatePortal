import { auth } from '@/auth';
import { NextResponse } from 'next/server';

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

function s(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() && String(v).trim().toLowerCase() !== 'null') return String(v).trim();
  }
  return '';
}

function toRow(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  // Handle wrapped shapes: { data: [...] } or { result: {...} }
  for (const key of ['data', 'Data', 'result', 'Result']) {
    const v = r[key];
    if (Array.isArray(v) && v.length > 0) return v[0] as Record<string, unknown>;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  }
  return r;
}

// GET /api/hr/members/biodata?enrolleeid=21000645%2F0
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.loginType !== 'hr') {
    return NextResponse.json({ error: 'Forbidden: HR accounts only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const enrolleeId = searchParams.get('enrolleeid');
  if (!enrolleeId) return NextResponse.json({ error: 'enrolleeid is required' }, { status: 400 });

  try {
    const token = await getServiceToken();
    const res = await fetch(
      `${BASE}/api/EnrolleeProfile/GetEnrolleeBioDataByEnrolleeID?enrolleeid=${encodeURIComponent(enrolleeId)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = null; }

    const row = toRow(raw);
    if (!row) return NextResponse.json({ error: 'No data found' }, { status: 404 });

    const phone = s(row,
      'MemberPhone', 'PhoneNumber', 'Phone', 'Mobile', 'GSMNo', 'MobileNo', 'GSM',
      'Tel', 'TelNo', 'CellPhone', 'MobilePhone', 'HomePhone', 'WorkPhone',
      'ContactPhone', 'Telephone',
    );
    const staffId = s(row,
      'MemberStaffid', 'EmployeeCode', 'employeecode', 'EmpCode', 'Staff_ID', 'StaffID',
      'EmployeeNo', 'EmpNo', 'StaffCode', 'HR_EmployeeID', 'Employee_Code', 'StaffNo',
    );
    const email = s(row, 'EmailAddress', 'Email', 'email', 'EmailAddr');
    const address = s(row, 'Physical_Add1', 'Address', 'HomeAddress', 'ResidentialAddress');
    const bloodGroup = s(row, 'BloodGroup', 'Blood_Group', 'bloodgroup');
    const genotype = s(row, 'genotype', 'Genotype');
    const hospital = s(row, 'Hospital', 'PreferredHospital', 'FacilityName');
    const dob = s(row, 'DateOfBirth', 'DOB', 'Member_DateOfBirth', 'BirthDate', 'Date_Of_Birth');
    let photo = s(row, 'EnrolleePicture', 'Enrolleepicture', 'Picture', 'MemberPicture', 'Photo', 'PassportPhoto', 'Base64Picture', 'ImageBase64', 'EnrolleeImage');
    let photoKey = photo ? 'known-alias' : '';
    // Fallback: Prognosis's actual field name for the photo isn't confirmed —
    // scan every key for one that looks like a base64 image (long, base64-charset,
    // and named like a picture/photo/image field) instead of guessing further.
    if (!photo) {
      for (const [key, value] of Object.entries(row)) {
        if (typeof value !== 'string' || value.length < 200) continue;
        if (!/pic|photo|image|img/i.test(key)) continue;
        const sample = value.replace(/\s+/g, '');
        if (!/^[A-Za-z0-9+/]+=*$/.test(sample.slice(0, 500))) continue;
        photo = sample;
        photoKey = key;
        break;
      }
    }
    const photoType = s(row, 'EnrolleePictureType', 'EnrolleepictureType', 'PictureType', 'PhotoType', 'ImageType') || 'image/jpeg';
    console.log(`[hr/members/biodata] ${enrolleeId} photo resolved via "${photoKey || 'none'}" (${photo ? photo.length : 0} chars). Row keys: ${Object.keys(row).join(', ')}`);

    return NextResponse.json({
      enrolleeId,
      phone: phone || null,
      staffId: staffId || null,
      email: email || null,
      address: address || null,
      bloodGroup: bloodGroup || null,
      genotype: genotype || null,
      hospital: hospital || null,
      dateOfBirth: dob || null,
      photo: photo || null,
      photoType,
      raw: row,
    });
  } catch (err) {
    console.error('[hr/members/biodata] Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch bio data' }, { status: 500 });
  }
}
