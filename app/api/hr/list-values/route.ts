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

export interface RelationshipOption {
  text: string;
  value: string;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const token = await getServiceToken();
    const res = await fetch(`${BASE}/api/ListValues/GetBeneficiaryRelationship`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    const text = await res.text();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch {
      return NextResponse.json({ error: 'Prognosis returned non-JSON', relationships: [] }, { status: 502 });
    }

    // Normalise to { text, value }[] — Prognosis returns { Text, Value, ... }
    const relationships: RelationshipOption[] = Array.isArray(raw)
      ? raw.map((item: Record<string, unknown>) => ({
          text: String(item.Text ?? item.text ?? '').trim(),
          value: String(item.Value ?? item.value ?? ''),
        })).filter((r) => r.text && r.value)
      : [];

    return NextResponse.json({ relationships });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), relationships: [] },
      { status: 500 }
    );
  }
}
