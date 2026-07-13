// Registers a new HR admin with Prognosis so it recognises the account for
// future login validation. Called from the verify-registration flow once the
// HR user has filled in their details, before the OTP is issued — OTP
// generation/verification itself remains entirely ours (see login-otp.ts).
const BASE = (process.env.PROGNOSIS_BASE_URL ?? 'https://prognosis-api.leadwayhealth.com')
  .replace(/\/api$/, '')
  .replace(/\/$/, '');

// Confirmed via ListValues/GetCountries: { country_id: 37, Country_Name: "Nigeria", CountryCode: "NG" }
const NIGERIA_COUNTRY_ID = 37;

export interface CorporateUserSignUpInput {
  email: string;
  password: string;
  phoneNumber: string;
  firstName: string;
  surname: string;
  groupId: string | number;
  dateOfBirth: string; // ISO date
  gender: string;
}

export interface CorporateUserSignUpResult {
  success: boolean;
  error?: string;
  raw?: unknown;
}

export async function callCorporateUserSignUp(
  token: string,
  input: CorporateUserSignUpInput,
): Promise<CorporateUserSignUpResult> {
  const requestPayload = {
    Password: input.password,
    ConfirmPassword: input.password,
    Email: input.email,
    Phonenumber: input.phoneNumber,
    New_Email: input.email,
    surname: input.surname,
    firstname: input.firstName,
    groupid: Number(input.groupId) || 0,
    occupationid: 0,
    ProfilePicture: '',
    DateOfBirth: input.dateOfBirth,
    Gender: input.gender,
    Street: '',
    CityID: 0,
    StateID: 0,
    CountryID: NIGERIA_COUNTRY_ID,
    TitleID: 0,
    ProfilePictureType: '',
    callbackurl: (process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? 'https://corporateportal.onrender.com').replace(/\/$/, '') + '/login',
    EnterService: true,
    ConsultServiceEntered: true,
    RegisterInvoice: true,
    ViewInvoices: true,
    Viewaccountstatement: true,
    Manageprescribers: true,
    ManageAdministrativestaff: true,
    ManageAccount: true,
    TitleName: '',
    Fixed: '',
    Function: '',
  };

  const url = `${BASE}/api/CorporateProfile/CorporateUserSignUp`;
  console.log(`[CorporateUserSignUp] → POST ${url} body=${JSON.stringify({ ...requestPayload, Password: '***', ConfirmPassword: '***' })}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestPayload),
    });
    const text = await res.text();
    console.log(`[CorporateUserSignUp] ← HTTP ${res.status}: ${text.slice(0, 500)}`);

    let raw: unknown;
    try { raw = JSON.parse(text); } catch { raw = text; }
    const r = raw as Record<string, unknown>;

    // Prognosis sometimes returns HTTP 200 with a logical error embedded in
    // the body (e.g. { status: 500, ... } or { Message: "..." }) — inspect
    // the body, not just res.ok.
    const bodyStatus = r?.status ?? r?.Status;
    const message = String(r?.message ?? r?.Message ?? r?.ErrorMessage ?? '');
    const looksFailed = !res.ok || (bodyStatus != null && Number(bodyStatus) >= 400) || /error|invalid|fail/i.test(message);

    if (looksFailed) {
      return { success: false, error: message || `Prognosis error (${res.status})`, raw };
    }
    return { success: true, raw };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to register with Prognosis' };
  }
}
