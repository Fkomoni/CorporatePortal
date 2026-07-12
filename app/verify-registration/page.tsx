'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';

type Stage = 'password' | 'otp' | 'success';

function VerifyForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // NOTE: the OTP is never read from the URL — it must be typed manually from
  // the separate OTP message (2FA). Do not re-add a `code` param prefill.
  const urlEmail        = searchParams?.get('email') ?? '';
  const urlGroupId      = searchParams?.get('groupId') ?? '';
  const urlPolicyNumber = searchParams?.get('policyNumber') ?? searchParams?.get('PolicyNumber') ?? '';
  const urlCompanyName  = searchParams?.get('company') ?? searchParams?.get('companyName') ?? '';
  const urlName         = searchParams?.get('name') ?? '';

  const [stage, setStage]           = useState<Stage>('password');
  const [email, setEmail]           = useState(urlEmail);
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [otp, setOtp]               = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [resending, setResending]   = useState(false);
  const [resendInfo, setResendInfo] = useState('');

  useEffect(() => { if (urlEmail) setEmail(urlEmail); }, [urlEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const fi = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#F56B22';
    e.target.style.boxShadow   = '0 0 0 3px rgba(245,107,34,0.10)';
  };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#E5E7F1';
    e.target.style.boxShadow   = 'none';
  };

  // ── Step 1: collect password, then request the OTP now that the user is
  // actually ready to use it (rather than it being sent automatically with
  // the welcome email, which risks expiring before they get here) ──────────
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim())                    { setError('Email address is required.'); return; }
    if (password !== confirm)             { setError('Passwords do not match.'); return; }
    if (password.length < 8)             { setError('Password must be at least 8 characters long.'); return; }
    if (!/[A-Z]/.test(password))         { setError('Password must include at least one uppercase letter (A–Z).'); return; }
    if (!/[a-z]/.test(password))         { setError('Password must include at least one lowercase letter (a–z).'); return; }
    if (!/[0-9]/.test(password))         { setError('Password must include at least one number (0–9).'); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError('Password must include at least one special character.'); return; }

    setLoading(true);
    try {
      const ok = await requestOtp();
      if (ok) setStage('otp');
    } finally {
      setLoading(false);
    }
  }

  // Shared by the initial "Continue to Verification" submit and the OTP
  // step's "Resend code" button — both just need a fresh code sent.
  async function requestOtp(): Promise<boolean> {
    try {
      const res = await fetch('/api/hr/request-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, groupId: urlGroupId, policyNumber: urlPolicyNumber, companyName: urlCompanyName, name: urlName || email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to send OTP. Please try again.');
        return false;
      }
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    }
  }

  async function handleResendOtp() {
    if (resending) return;
    setError(''); setResendInfo('');
    setResending(true);
    try {
      const ok = await requestOtp();
      if (ok) { setOtp(''); setResendInfo('A new code has been sent.'); }
    } finally {
      setResending(false);
    }
  }

  // ── Step 2: submit OTP + password ────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!otp.trim()) { setError('Please enter the OTP sent to you.'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/hr/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationcode: otp.trim(),
          password,
          email,
          groupId: urlGroupId,
          policyNumber: urlPolicyNumber,
          companyName: urlCompanyName,
          name: urlName || email,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Invalid OTP. Please check and try again.');
      } else {
        setStage('success');
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

  // ── Password strength (5 criteria per Leadway policy) ───────────────────
  let strength = 0;
  if (password.length >= 8)            strength++;
  if (/[A-Z]/.test(password))          strength++;
  if (/[a-z]/.test(password))          strength++;
  if (/[0-9]/.test(password))          strength++;
  if (/[^A-Za-z0-9]/.test(password))  strength++;
  const strengthColours = ['#EF4444', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
  const strengthLabels  = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* ── Left panel ── */}
      <div
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '50%', padding: '44px 52px', background: '#131C4E' }}
        className="hidden lg:flex"
      >
        {/* Logo */}
        <div>
          <Image src="/leadway-logo.jpeg" alt="Leadway Health HMO" width={180} height={54} style={{ borderRadius: 8, objectFit: 'contain' }} />
        </div>

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Account Setup — HR Access
            </p>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16 }}>
              Welcome to<br />the Corporate<br />Portal.
            </h1>
            <p style={{ fontSize: 15, color: '#A8AECB', lineHeight: 1.6 }}>
              Complete your account setup in two quick steps to start managing your corporate health scheme.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { step: '1', title: 'Create a Password',       desc: 'Set a secure password for your HR admin account.' },
              { step: '2', title: 'Enter Your OTP',          desc: 'Verify with the one-time code sent to your phone.' },
              { step: '3', title: 'Access the Portal',       desc: 'Sign in and start managing your scheme.' },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,107,34,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#F56B22' }}>{step}</span>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</p>
                  <p style={{ fontSize: 12, color: '#7B82AA', marginTop: 2, lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#3A4382' }}>© 2025 Leadway Health Limited. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Mobile logo */}
          <div style={{ marginBottom: 28 }} className="lg:hidden">
            <Image src="/leadway-logo.jpeg" alt="Leadway Health HMO" width={140} height={42} style={{ borderRadius: 6, objectFit: 'contain' }} />
          </div>

          {/* ── Success ── */}
          {stage === 'success' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', border: '2px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 style={{ width: 32, height: 32, color: '#10B981' }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>Account Ready!</h2>
              <p style={{ fontSize: 14, color: '#6B7480', lineHeight: 1.6 }}>
                Your account has been set up successfully.<br />Redirecting you to sign in…
              </p>
            </div>
          )}

          {/* ── Step indicator ── */}
          {stage !== 'success' && (
            <>
              {/* Badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: '#FFF5EF', border: '1px solid rgba(245,107,34,0.2)', marginBottom: 20 }}>
                <ShieldCheck style={{ width: 13, height: 13, color: '#F56B22' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#F56B22', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Account Setup</span>
              </div>

              {/* Step pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                {(['password', 'otp'] as Stage[]).map((s, i) => {
                  const done    = stage === 'otp' && s === 'password';
                  const current = stage === s;
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: done ? '#ECFDF5' : current ? '#F56B22' : '#F0F1F8', color: done ? '#10B981' : current ? '#fff' : '#B0B7C9', border: done ? '2px solid #10B981' : 'none', flexShrink: 0 }}>
                          {done ? '✓' : i + 1}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: current ? '#131C4E' : '#B0B7C9' }}>
                          {s === 'password' ? 'Set Password' : 'Verify OTP'}
                        </span>
                      </div>
                      {i === 0 && <div style={{ width: 24, height: 2, background: stage === 'otp' ? '#10B981' : '#E5E7F1', borderRadius: 2 }} />}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Step 1: Set Password ── */}
          {stage === 'password' && (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>Set Up Your Account</h2>
              <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 28, lineHeight: 1.5 }}>Create a password for your Leadway Health Corporate Portal Admin account.</p>

              <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  {urlEmail ? (
                    <div style={{ height: 44, padding: '0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#F7F8FC', color: '#6B7280', display: 'flex', alignItems: 'center' }}>
                      {email}
                    </div>
                  ) : (
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your.email@company.com" required style={inputStyle} onFocus={fi} onBlur={fo} />
                  )}
                </div>

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

                {/* Strength bar */}
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

                <button type="submit" disabled={loading || !email || !password || !confirm || password !== confirm}
                  style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(245,107,34,0.30)', opacity: (loading || !email || !password || !confirm || password !== confirm) ? 0.55 : 1, marginTop: 4 }}>
                  {loading ? 'Sending code…' : 'Continue to Verification →'}
                </button>
              </form>

              <p style={{ fontSize: 12, textAlign: 'center', marginTop: 24, color: '#B8BFD0' }}>
                Already have an account?{' '}
                <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#F56B22', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Sign in instead</button>
              </p>
            </>
          )}

          {/* ── Step 2: OTP ── */}
          {stage === 'otp' && (
            <>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>Verify Your Identity</h2>
              <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 24, lineHeight: 1.5 }}>Enter the one-time code sent to your registered mobile number or email.</p>

              {/* Email pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: 10, padding: '11px 14px', marginBottom: 24 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#131C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <KeyRound style={{ width: 14, height: 14, color: '#fff' }} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Setting up account for</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{email}</p>
                </div>
              </div>

              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={labelStyle}>One-Time Passcode (OTP)</label>
                  <input type="text" inputMode="text" value={otp} onChange={(e) => setOtp(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="Enter OTP" required
                    style={{ ...inputStyle, letterSpacing: '0.3em', fontWeight: 700, fontSize: 22, textAlign: 'center' }} onFocus={fi} onBlur={fo} />
                </div>

                {resendInfo && (
                  <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>{resendInfo}</div>
                )}

                {error && (
                  <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{error}</div>
                )}

                <button type="submit" disabled={loading || otp.length < 4}
                  style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(245,107,34,0.30)', opacity: (loading || otp.length < 4) ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? (
                    <>
                      <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Verifying…
                    </>
                  ) : 'Verify & Access Portal →'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button type="button" onClick={() => { setStage('password'); setError(''); setResendInfo(''); }}
                    style={{ height: 40, borderRadius: 10, border: 'none', background: 'transparent', color: '#9CA3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    ← Back to password
                  </button>
                  <button type="button" onClick={handleResendOtp} disabled={resending}
                    style={{ height: 40, borderRadius: 10, border: 'none', background: 'transparent', color: '#F56B22', fontSize: 12, fontWeight: 600, cursor: resending ? 'wait' : 'pointer', padding: 0 }}>
                    {resending ? 'Sending…' : 'Resend code'}
                  </button>
                </div>
              </form>
            </>
          )}

          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 28, color: '#B8BFD0' }}>
            Protected by Leadway Health security. Your data is encrypted and secure.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function VerifyRegistrationPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <p style={{ fontSize: 14, color: '#9CA3B8' }}>Loading…</p>
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
