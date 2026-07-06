'use client';

export const dynamic = 'force-dynamic';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams?.get('token') ?? '';
  const email = searchParams?.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [done, setDone]         = useState(false);

  const fi = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#F56B22';
    e.target.style.boxShadow   = '0 0 0 3px rgba(245,107,34,0.10)';
  };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#E5E7F1';
    e.target.style.boxShadow   = 'none';
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm)            { setError('Passwords do not match.'); return; }
    if (password.length < 8)             { setError('Password must be at least 8 characters long.'); return; }
    if (!/[A-Z]/.test(password))         { setError('Password must include at least one uppercase letter (A–Z).'); return; }
    if (!/[a-z]/.test(password))         { setError('Password must include at least one lowercase letter (a–z).'); return; }
    if (!/[0-9]/.test(password))         { setError('Password must include at least one number (0–9).'); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError('Password must include at least one special character.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/hr/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Could not activate your account.');
      } else {
        setDone(true);
        setTimeout(() => router.push('/login'), 3000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 14px', fontSize: 14,
    border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC',
    color: '#131C4E', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7,
  };

  // Strength meter — 5 criteria per Leadway policy
  let strength = 0;
  if (password.length >= 8)            strength++;
  if (/[A-Z]/.test(password))          strength++;
  if (/[a-z]/.test(password))          strength++;
  if (/[0-9]/.test(password))          strength++;
  if (/[^A-Za-z0-9]/.test(password))  strength++;
  const strengthColours = ['#EF4444', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
  const strengthLabels  = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!token || !email) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>Invalid invitation link</p>
        <p style={{ fontSize: 13, color: '#9CA3B8' }}>This link is missing required information. Ask your administrator to send a new invitation.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ marginBottom: 28 }}>
        <Image src="/leadway-logo.jpeg" alt="Leadway Health HMO" width={140} height={42} style={{ borderRadius: 6, objectFit: 'contain' }} />
      </div>

      {done ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', border: '2px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 style={{ width: 32, height: 32, color: '#10B981' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>Account Activated!</h2>
          <p style={{ fontSize: 14, color: '#6B7480', lineHeight: 1.6 }}>Your account is ready.<br />Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: '#FFF5EF', border: '1px solid rgba(245,107,34,0.2)', marginBottom: 20 }}>
            <ShieldCheck style={{ width: 13, height: 13, color: '#F56B22' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F56B22', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Accept Invitation</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>Set Up Your Account</h2>
          <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 28, lineHeight: 1.5 }}>
            Create a password for <strong style={{ color: '#131C4E' }}>{email}</strong> to activate your Corporate Portal account.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" required style={{ ...inputStyle, paddingRight: 44 }} onFocus={fi} onBlur={fo} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B8BFD0', padding: 0, display: 'flex' }}>
                  {showPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 5 }}>Min 8 characters · uppercase · lowercase · number · special character</p>
            </div>

            {password.length > 0 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: -12 }}>
                {[0,1,2,3,4].map((i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < strength ? strengthColours[strength - 1] : '#E5E7F1', transition: 'background 0.2s' }} />
                ))}
                <span style={{ fontSize: 11, fontWeight: 600, color: strengthColours[strength - 1], marginLeft: 6, minWidth: 52 }}>{strengthLabels[strength - 1]}</span>
              </div>
            )}

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showConf ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" required
                  style={{ ...inputStyle, paddingRight: 44, borderColor: confirm && confirm !== password ? '#EF4444' : '#E5E7F1' }}
                  onFocus={fi}
                  onBlur={(e) => { e.target.style.borderColor = confirm && confirm !== password ? '#EF4444' : '#E5E7F1'; e.target.style.boxShadow = 'none'; }} />
                <button type="button" onClick={() => setShowConf(!showConf)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B8BFD0', padding: 0, display: 'flex' }}>
                  {showConf ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
              {confirm && confirm !== password && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 5 }}>Passwords do not match</p>}
            </div>

            {error && (
              <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</div>
            )}

            <button type="submit" disabled={loading || !password || !confirm || password !== confirm}
              style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(245,107,34,0.30)', opacity: (loading || !password || !confirm || password !== confirm) ? 0.55 : 1 }}>
              {loading ? 'Activating…' : 'Activate Account →'}
            </button>
          </form>
        </>
      )}

      <p style={{ fontSize: 12, textAlign: 'center', marginTop: 28, color: '#B8BFD0' }}>
        Protected by Leadway Health security. Your data is encrypted and secure.
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32 }}>
      <Suspense fallback={<p style={{ fontSize: 14, color: '#9CA3B8' }}>Loading…</p>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
