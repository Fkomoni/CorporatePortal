'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, ShieldCheck, BarChart3, Users, FileText, Building2,
  Mail, Lock, Headphones, Lock as LockSmall, CheckCircle2,
} from 'lucide-react';

// Shared field styling. Inputs carry a leading icon, so the left padding makes
// room for it — see IconField below.
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7,
};
const INPUT: React.CSSProperties = {
  width: '100%', height: 46, fontSize: 14, border: '1.5px solid #E5E7F1',
  borderRadius: 12, background: '#FAFBFC', color: '#131C4E', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
};

function IconField({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon style={{
        position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)',
        width: 16, height: 16, color: '#B0B7C9', pointerEvents: 'none', zIndex: 1,
      }} />
      {children}
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState('');
  // 2FA step: shown when the account requires an emailed OTP
  const [otpStep, setOtpStep]   = useState(false);
  const [otp, setOtp]           = useState('');
  const [resending, setResending] = useState(false);
  const router = useRouter();

  // ── Forgot password ──────────────────────────────────────────────────────
  const [forgotStep, setForgotStep] = useState<null | 'email' | 'reset' | 'done'>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotShowPass, setForgotShowPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotInfo, setForgotInfo] = useState('');

  function openForgot() {
    setForgotStep('email');
    setForgotEmail(email);
    setForgotCode(''); setForgotPassword(''); setForgotConfirm('');
    setForgotError(''); setForgotInfo('');
  }
  function closeForgot() {
    setForgotStep(null);
    setForgotError(''); setForgotInfo('');
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) { setForgotError('Email is required.'); return; }
    setForgotError(''); setForgotLoading(true);
    try {
      const res = await fetch('/api/hr/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: forgotEmail.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setForgotError(json.error ?? 'Failed to send reset code.'); return; }
      setForgotInfo('If an account exists for this email, a reset code has been sent.');
      setForgotStep('reset');
    } catch {
      setForgotError('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    if (!forgotCode.trim()) { setForgotError('Please enter the reset code.'); return; }
    if (forgotPassword !== forgotConfirm) { setForgotError('Passwords do not match.'); return; }
    if (forgotPassword.length < 8) { setForgotError('Password must be at least 8 characters long.'); return; }
    if (!/[A-Z]/.test(forgotPassword) || !/[a-z]/.test(forgotPassword) || !/[0-9]/.test(forgotPassword) || !/[^A-Za-z0-9]/.test(forgotPassword)) {
      setForgotError('Password must include uppercase, lowercase, a number and a special character.'); return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch('/api/hr/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email: forgotEmail.trim(), code: forgotCode.trim(), newPassword: forgotPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setForgotError(json.error ?? 'Failed to reset password.'); return; }
      setForgotStep('done');
    } catch {
      setForgotError('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  const completeSignIn = async (otpCode?: string) => {
    const result = await signIn('hr-credentials', {
      email,
      password,
      ...(otpCode ? { otp: otpCode } : {}),
      redirect: false,
    });
    if (result?.error) {
      setError(otpCode ? 'Incorrect or expired code. Please try again.' : 'Invalid email or password. Please try again.');
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (otpStep) {
        await completeSignIn(otp.trim());
        return;
      }

      // Step 1: validate credentials + find out if this account needs 2FA
      const pre = await fetch('/api/hr/pre-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const preJson = await pre.json().catch(() => ({}));

      if (!pre.ok) {
        setError(preJson.error ?? 'Invalid email or password. Please try again.');
        return;
      }

      if (preJson.twoFaRequired) {
        setOtpStep(true);
        setOtp('');
        if (!preJson.otpSent) setError('We could not send the verification code. Use Resend to try again.');
        return;
      }

      await completeSignIn();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await fetch('/api/hr/pre-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError(json.error ?? 'Could not resend the code.');
      else if (!json.otpSent) setError('We could not send the verification code. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const fi = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#F56B22';
    e.target.style.boxShadow   = '0 0 0 3px rgba(245,107,34,0.10)';
  };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#E5E7F1';
    e.target.style.boxShadow   = 'none';
  };

  const primaryBtn: React.CSSProperties = {
    width: '100%', height: 50, borderRadius: 12, border: 'none',
    background: 'var(--gradient-sunset)', color: '#fff', fontSize: 14.5, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 6px 18px -4px rgba(245,107,34,0.45)',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'inherit', background: '#fff' }}>

      {/* ── Left panel ── navy gradient with the brand swoosh. The mockup used a
          licensed architectural photograph, which we don't have in the repo — the
          swoosh and glow below are drawn in CSS/SVG so nothing is missing. Drop a
          photo in behind `swoosh` if the licensed asset turns up. */}
      <div
        className="hidden lg:flex"
        style={{
          position: 'relative', overflow: 'hidden',
          flexDirection: 'column', justifyContent: 'space-between',
          width: '48%', padding: '44px 52px', background: 'var(--gradient-navy)',
        }}
      >
        {/* Soft orange glow, upper right */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: -160, right: -140, width: 460, height: 460,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,107,34,0.22) 0%, rgba(245,107,34,0) 70%)',
        }} />
        {/* Brand swoosh, lower left */}
        <svg aria-hidden="true" viewBox="0 0 600 400" preserveAspectRatio="none"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 320, opacity: 0.95 }}>
          <defs>
            <linearGradient id="swoosh" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#F56B22" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#E25A12" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#131C4E" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,400 C150,300 200,180 600,120 L600,400 Z" fill="url(#swoosh)" />
        </svg>

        {/* Logo — official artwork, knockout variant so the wordmark reads on navy */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leadway-health-logo-light.png" alt="Leadway Health" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.22)' }} />
          <p style={{ fontSize: 14, color: '#D5D9EA' }}>Corporate Portal</p>
        </div>

        {/* Hero copy */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 30, margin: '36px 0' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18 }}>
              Corporate Portal for HR &amp; Finance
            </p>
            <h1 style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1.14, letterSpacing: '-0.02em', marginBottom: 18 }}>
              Your scheme.<br />Your data.<br /><span style={{ color: '#F56B22' }}>Your decisions.</span>
            </h1>
            <p style={{ fontSize: 15, color: '#A8AECB', lineHeight: 1.65, maxWidth: 440 }}>
              A powerful platform built for HR and Finance teams to manage your corporate
              health scheme with full visibility and control.
            </p>
          </div>

          {/* Feature cards — 2×2 so they read as substantial blocks in a narrow column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { icon: Users,       title: 'Manage Members',      desc: 'Add, update and terminate employees seamlessly.' },
              { icon: BarChart3,   title: 'Monitor Performance', desc: 'Track claims, utilization and scheme performance.' },
              { icon: ShieldCheck, title: 'Full Transparency',   desc: 'Every benefit plan and coverage detail, visible.' },
              { icon: FileText,    title: 'Finance & Reports',   desc: 'Automate invoicing and access powerful analytics.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{
                padding: '16px 16px 18px', borderRadius: 14,
                background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)',
                backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, marginBottom: 12,
                  background: 'rgba(245,107,34,0.16)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon style={{ width: 16, height: 16, color: '#F56B22' }} strokeWidth={2} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</p>
                <p style={{ fontSize: 11.5, color: '#7B82AA', lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scale + footer */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 16 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>390,000+</span>
            <span style={{ fontSize: 12.5, color: '#A8AECB' }}>members covered by Leadway Health</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {['Secure', 'Reliable', 'Always Here'].map((t, i) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#7B82AA' }}>
                {i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#3A4382' }} />}
                {t}
              </span>
            ))}
            <span style={{ fontSize: 11, color: '#3A4382', marginLeft: 'auto' }}>© 2026 Leadway Health Limited.</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{
        flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#F7F8FC', padding: '40px 32px',
      }}>
        {/* Faint dot grid, upper right */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, right: 0, width: 300, height: 300, opacity: 0.5,
          backgroundImage: 'radial-gradient(#D9DEEF 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
        }} />

        {/* Elevated form card */}
        <div style={{
          position: 'relative', width: '100%', maxWidth: 468,
          background: '#fff', borderRadius: 22, border: '1px solid #EDEEF2',
          boxShadow: 'var(--shadow-float, 0 18px 44px -12px rgba(19,28,78,0.20))',
          padding: '38px 40px 32px',
        }}>

          {/* Logo — full-colour official artwork on white */}
          <div style={{ marginBottom: 24 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leadway-health-logo.png" alt="Leadway Health" style={{ height: 46, width: 'auto', objectFit: 'contain', display: 'block' }} />
            <p style={{ fontSize: 14.5, color: '#6B7480', marginTop: 9 }}>Corporate Portal</p>
          </div>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: '#FFF5EF', border: '1px solid rgba(245,107,34,0.2)', marginBottom: 20 }}>
            <ShieldCheck style={{ width: 13, height: 13, color: '#F56B22' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F56B22', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Secure HR Sign-In</span>
          </div>

          {forgotStep ? (
            <>
              <h2 style={{ fontSize: 27, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', marginBottom: 6 }}>
                {forgotStep === 'done' ? 'Password reset' : 'Reset your password'}
              </h2>
              <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 30 }}>
                {forgotStep === 'email' && 'Enter your account email and we\'ll send you a reset code.'}
                {forgotStep === 'reset' && <>Enter the code sent to <strong style={{ color: '#131C4E' }}>{forgotEmail}</strong> and choose a new password.</>}
                {forgotStep === 'done' && 'Your password has been reset. You can now sign in with your new password.'}
              </p>

              {forgotStep === 'email' && (
                <form onSubmit={handleForgotRequest} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={LABEL}>Email Address</label>
                    <IconField icon={Mail}>
                      <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus
                        placeholder="chidi.nwosu@acmecorp.com"
                        style={{ ...INPUT, padding: '0 14px 0 42px' }}
                        onFocus={fi} onBlur={fo} />
                    </IconField>
                  </div>
                  {forgotError && (
                    <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{forgotError}</div>
                  )}
                  <button type="submit" disabled={forgotLoading}
                    style={{ ...primaryBtn, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Sending…' : <>Send Reset Code <span aria-hidden="true">→</span></>}
                  </button>
                  <button type="button" onClick={closeForgot} style={{ fontSize: 12, fontWeight: 600, color: '#9CA3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'center' }}>
                    ← Back to sign in
                  </button>
                </form>
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={handleForgotReset} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {forgotInfo && (
                    <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>{forgotInfo}</div>
                  )}
                  <div>
                    <label style={LABEL}>Reset Code</label>
                    <input type="text" inputMode="numeric" value={forgotCode} autoFocus
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" required
                      style={{ ...INPUT, height: 54, padding: '0 14px', fontSize: 24, fontWeight: 700, letterSpacing: '0.35em', textAlign: 'center' }}
                      onFocus={fi} onBlur={fo} />
                  </div>
                  <div>
                    <label style={LABEL}>New Password</label>
                    <IconField icon={Lock}>
                      <input type={forgotShowPass ? 'text' : 'password'} value={forgotPassword} onChange={(e) => setForgotPassword(e.target.value)}
                        placeholder="••••••••" required autoComplete="new-password"
                        style={{ ...INPUT, padding: '0 44px 0 42px' }}
                        onFocus={fi} onBlur={fo} />
                      <button type="button" onClick={() => setForgotShowPass(!forgotShowPass)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B8BFD0', padding: 0, display: 'flex' }}>
                        {forgotShowPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                      </button>
                    </IconField>
                    <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 6 }}>Min 8 characters, with uppercase, lowercase, a number and a special character.</p>
                  </div>
                  <div>
                    <label style={LABEL}>Confirm New Password</label>
                    <IconField icon={Lock}>
                      <input type={forgotShowPass ? 'text' : 'password'} value={forgotConfirm} onChange={(e) => setForgotConfirm(e.target.value)}
                        placeholder="••••••••" required autoComplete="new-password"
                        style={{ ...INPUT, padding: '0 14px 0 42px' }}
                        onFocus={fi} onBlur={fo} />
                    </IconField>
                  </div>
                  {forgotError && (
                    <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{forgotError}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button type="button" onClick={() => setForgotStep('email')} style={{ fontSize: 12, fontWeight: 600, color: '#9CA3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      ← Back
                    </button>
                    <button type="button" onClick={handleForgotRequest} disabled={forgotLoading} style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: forgotLoading ? 'wait' : 'pointer', padding: 0 }}>
                      {forgotLoading ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                  <button type="submit" disabled={forgotLoading}
                    style={{ ...primaryBtn, cursor: forgotLoading ? 'not-allowed' : 'pointer', opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Resetting…' : <>Reset Password <span aria-hidden="true">→</span></>}
                  </button>
                </form>
              )}

              {forgotStep === 'done' && (
                <button type="button" onClick={() => { closeForgot(); setPassword(''); }}
                  style={{ ...primaryBtn, cursor: 'pointer' }}>
                  ← Back to Sign In
                </button>
              )}
            </>
          ) : (
          <>
          <h2 style={{ fontSize: 27, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', marginBottom: 6 }}>
            {otpStep ? 'Two-factor verification' : 'Welcome back'}
          </h2>
          <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 30 }}>
            {otpStep
              ? <>Enter the 6-digit code we sent to <strong style={{ color: '#131C4E' }}>{email}</strong>.</>
              : 'Sign in to manage your corporate health scheme.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {!otpStep && (
            <div>
              <label style={LABEL}>Email Address</label>
              <IconField icon={Mail}>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="chidi.nwosu@acmecorp.com" required autoComplete="username"
                  style={{ ...INPUT, padding: '0 14px 0 42px' }}
                  onFocus={fi} onBlur={fo}
                />
              </IconField>
            </div>
            )}

            {!otpStep && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>Password</label>
                <button type="button" onClick={openForgot} style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
              <IconField icon={Lock}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ ...INPUT, padding: '0 44px 0 42px' }}
                  onFocus={fi} onBlur={fo}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B8BFD0', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </IconField>
            </div>
            )}

            {otpStep && (
            <div>
              <label style={LABEL}>One-Time Passcode</label>
              <input
                type="text" inputMode="numeric" value={otp} autoFocus
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required
                style={{ ...INPUT, height: 54, padding: '0 14px', fontSize: 24, fontWeight: 700, letterSpacing: '0.35em', textAlign: 'center' }}
                onFocus={fi} onBlur={fo}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <button type="button" onClick={() => { setOtpStep(false); setOtp(''); setError(''); }}
                  style={{ fontSize: 12, fontWeight: 600, color: '#9CA3B8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  ← Back
                </button>
                <button type="button" onClick={handleResend} disabled={resending}
                  style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: resending ? 'wait' : 'pointer', padding: 0 }}>
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </div>
            )}

            {error && (
              <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading || (otpStep && otp.length < 6)}
              style={{ ...primaryBtn, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1, marginTop: 4 }}>
              {isLoading ? (
                <>
                  <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : otpStep ? <>Verify &amp; Sign In <span aria-hidden="true">→</span></> : <>Sign in to Corporate Portal <span aria-hidden="true">→</span></>}
            </button>
          </form>

          {/* Leadway's own staff sign in to a different console, so this is a
              real alternative route rather than a footnote — give it the weight
              of a secondary action. Hidden during OTP/reset to keep those
              flows single-purpose. */}
          {!otpStep && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 18px' }}>
                <div style={{ flex: 1, height: 1, background: '#EDEEF2' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#B8BFD0', letterSpacing: '0.08em' }}>OR</span>
                <div style={{ flex: 1, height: 1, background: '#EDEEF2' }} />
              </div>

              <a href="/admin/login"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', height: 48, borderRadius: 12, boxSizing: 'border-box',
                  border: '1.5px solid #E5E7F1', background: '#fff',
                  color: '#131C4E', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                }}>
                <Building2 style={{ width: 16, height: 16, color: '#131C4E' }} />
                Leadway Staff Login
                <span aria-hidden="true">→</span>
              </a>

              {/* Support affordance — cuts the "who do I email?" support traffic */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 20,
                padding: '14px 16px', borderRadius: 14, background: '#FAFBFC', border: '1px solid #EDEEF2',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#FFF5EF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Headphones style={{ width: 15, height: 15, color: '#F56B22' }} strokeWidth={2} />
                </div>
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: '#131C4E', marginBottom: 2 }}>Need help signing in?</p>
                  <p style={{ fontSize: 11.5, color: '#9CA3B8', lineHeight: 1.5 }}>
                    Contact your scheme administrator or reach the Leadway Health support team.
                  </p>
                </div>
              </div>
            </>
          )}
          </>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18,
            marginTop: 26, paddingTop: 18, borderTop: '1px solid #F1F2F7',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#B0B7C9' }}>
              <LockSmall style={{ width: 12, height: 12 }} /> Encrypted in transit
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#B0B7C9' }}>
              <CheckCircle2 style={{ width: 12, height: 12 }} /> Protected by Leadway Health security
            </span>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
