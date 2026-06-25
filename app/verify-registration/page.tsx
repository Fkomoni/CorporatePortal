'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Stage = 'password' | 'otp' | 'success';

function VerifyForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Accept ?code= or ?corporateId= (Prognosis uses corporateId in their link)
  const urlToken = searchParams?.get('code') ?? searchParams?.get('corporateId') ?? '';
  const urlEmail = searchParams?.get('email') ?? '';

  const [stage, setStage]       = useState<Stage>('password');
  const [email, setEmail]       = useState(urlEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [otp, setOtp]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { if (urlEmail) setEmail(urlEmail); }, [urlEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 1: collect password (no API call — OTP already sent by Prognosis) ──
  function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim())           { setError('Email address is required.'); return; }
    if (password !== confirm)    { setError('Passwords do not match.'); return; }
    if (password.length < 8)     { setError('Password must be at least 8 characters.'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must include a number.'); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError('Password must include a special character.'); return; }
    setStage('otp');
  }

  // ── Step 2: submit OTP + password together to ClientAppVerifyRegistration ──
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!otp.trim()) { setError('Please enter the OTP sent to you.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/hr/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationcode: otp.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Invalid OTP. Please check and try again.');
      } else {
        setStage('success');
        setTimeout(() => router.push('/login'), 2500);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 48, padding: '0 16px', fontSize: 14,
    border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC',
    color: '#131C4E', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#9CA3B8',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    display: 'block', marginBottom: 7,
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; };
  const onBlur  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; };

  return (
    <div style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}>

      {/* ── Success ── */}
      {stage === 'success' && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>Account Ready!</p>
          <p style={{ fontSize: 13, color: '#9CA3B8', lineHeight: 1.6 }}>
            Your account has been set up successfully.<br />Redirecting you to login…
          </p>
        </div>
      )}

      {/* ── Step indicator ── */}
      {stage !== 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          {(['password', 'otp'] as Stage[]).map((s, i) => {
            const done    = (stage === 'otp' && s === 'password');
            const current = stage === s;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: done ? '#ECFDF5' : current ? '#F56B22' : '#F0F1F8', color: done ? '#10B981' : current ? '#fff' : '#B0B7C9', border: done ? '2px solid #10B981' : current ? 'none' : '2px solid #E5E7F1', flexShrink: 0 }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: current ? '#131C4E' : '#B0B7C9' }}>
                  {s === 'password' ? 'Set Password' : 'Verify OTP'}
                </span>
                {i === 0 && <div style={{ width: 28, height: 2, background: stage === 'otp' ? '#10B981' : '#E5E7F1', borderRadius: 2, marginLeft: 2 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step 1: Set Password ── */}
      {stage === 'password' && (
        <>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', marginBottom: 5 }}>Set Up Your Account</p>
            <p style={{ fontSize: 13, color: '#9CA3B8', lineHeight: 1.5 }}>Enter your email address and create a password for your admin account.</p>
          </div>

          <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              {urlEmail ? (
                /* Email known from URL — show read-only */
                <div style={{ height: 48, padding: '0 16px', fontSize: 14, border: '1px solid #E5E7F1', borderRadius: 14, background: '#F7F8FC', color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: '#131C4E', fontWeight: 500 }}>{email}</span>
                </div>
              ) : (
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your.email@company.com" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              )}
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" required style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 5 }}>Minimum 8 characters, must include a special character and a number</p>
            </div>

            {/* Password strength bar */}
            {password.length > 0 && (() => {
              let strength = 0;
              if (password.length >= 8) strength++;
              if (/[A-Z]/.test(password)) strength++;
              if (/[0-9]/.test(password)) strength++;
              if (/[^A-Za-z0-9]/.test(password)) strength++;
              const colours = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
              const labels  = ['Weak', 'Fair', 'Good', 'Strong'];
              return (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: -8 }}>
                  {[0,1,2,3].map((i) => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < strength ? colours[strength - 1] : '#E5E7F1', transition: 'background 0.2s' }} />
                  ))}
                  <span style={{ fontSize: 11, fontWeight: 600, color: colours[strength - 1], marginLeft: 6, minWidth: 44 }}>{labels[strength - 1]}</span>
                </div>
              );
            })()}

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" required style={{ ...inputStyle, borderColor: confirm && confirm !== password ? '#EF4444' : '#E5E7F1' }} onFocus={onFocus} onBlur={(e) => { e.currentTarget.style.borderColor = confirm && confirm !== password ? '#EF4444' : '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
              {confirm && confirm !== password && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 5 }}>Passwords do not match</p>}
            </div>

            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#EF4444', fontWeight: 500 }}>{error}</div>}

            <button type="submit" disabled={loading || !email || !password || !confirm || password !== confirm}
              style={{ height: 50, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || !email || !password || !confirm || password !== confirm) ? 0.55 : 1, boxShadow: '0 4px 14px rgba(245,107,34,0.32)', marginTop: 4 }}>
              {loading ? 'Setting up…' : 'Proceed'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#9CA3B8' }}>
            Already have an account?{' '}
            <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#F56B22', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Sign in instead?</button>
          </p>
        </>
      )}

      {/* ── Step 2: OTP ── */}
      {stage === 'otp' && (
        <>
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', marginBottom: 5 }}>Enter Your OTP</p>
            <p style={{ fontSize: 13, color: '#9CA3B8', lineHeight: 1.5 }}>
              A one-time passcode has been sent to your registered mobile number or email. Enter it below to complete setup.
            </p>
          </div>

          {/* Email pill reminder */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: 12, padding: '11px 16px', marginBottom: 20 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#131C4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13, color: '#fff' }}>@</span>
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Setting up account for</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{email}</p>
            </div>
          </div>

          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>One-Time Passcode (OTP)</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="Enter OTP" required
                style={{ ...inputStyle, letterSpacing: '0.25em', fontWeight: 700, fontSize: 20, textAlign: 'center' }} onFocus={onFocus} onBlur={onBlur} />
            </div>

            {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#EF4444', fontWeight: 500 }}>{error}</div>}

            <button type="submit" disabled={loading || otp.length < 4}
              style={{ height: 50, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || otp.length < 4) ? 0.55 : 1, boxShadow: '0 4px 14px rgba(245,107,34,0.32)', marginTop: 4 }}>
              {loading ? 'Verifying…' : 'Verify & Access Portal'}
            </button>

            <button type="button" onClick={() => { setStage('password'); setOtp(''); setError(''); }}
              style={{ height: 40, borderRadius: 14, border: 'none', background: 'transparent', color: '#9CA3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ← Back to password
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function VerifyRegistrationPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #131C4E 0%, #1E2D72 50%, #2A3A8C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F56B22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '-0.04em' }}>LH</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>LEADWAY</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', marginTop: -2 }}>HEALTH HMO</p>
            </div>
          </div>
        </div>

        <Suspense fallback={
          <div style={{ background: '#fff', borderRadius: 24, padding: '48px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#9CA3B8' }}>Loading…</p>
          </div>
        }>
          <VerifyForm />
        </Suspense>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          © 2025 Leadway Health HMO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
