'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BrandBackdrop } from '@/components/ui/BrandBackdrop';
import {
  Eye, EyeOff, ShieldCheck, Users, BarChart3, Hospital, FileText,
  Building2, Mail, Lock, Headphones, ArrowRight, Lock as LockIcon,
  BadgeCheck, ShieldHalf,
} from 'lucide-react';

/*  Brand  */
const ORANGE = '#E87722';
const NAVY   = '#1A1A2E';
const NAVY_2 = '#101827';
const BORDER = '#E6E8EC';
const INK    = '#1A1A2E';
const MUTED  = '#6B7280';
const FAINT  = '#9AA1AE';

/* Shared field chrome. The ring lives on the wrapper (.field-ring) so the
   leading icon sits inside the focus highlight. */
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 8,
};
const FIELD: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, height: 58,
  padding: '0 18px', borderRadius: 16, border: `1px solid ${BORDER}`, background: '#FBFCFD',
};
const INPUT: React.CSSProperties = {
  flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none',
  background: 'transparent', fontSize: 15, fontWeight: 500, color: INK,
};

function Field({
  icon: Icon, children, trailing,
}: { icon: React.ElementType; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="field-ring" style={FIELD}>
      <Icon style={{ width: 18, height: 18, color: FAINT, flexShrink: 0 }} strokeWidth={2} aria-hidden="true" />
      {children}
      {trailing}
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

  //  Forgot password
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
      if (!res.ok) { setForgotError(json.error ?? 'Failed to send the code.'); return; }
      setForgotInfo('If an account exists for this email, a code has been sent.');
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
    if (!forgotCode.trim()) { setForgotError('Please enter the code.'); return; }
    if (!forgotPassword) { setForgotError('Enter your Leadway Health password.'); return; }
    if (forgotPassword !== forgotConfirm) { setForgotError('The two entries do not match.'); return; }
    // No complexity rules: this is an existing Leadway Health password, not a new
    // one, and the portal's own rules would reject correct passwords that predate
    // them, leaving the account locked out for the wrong reason.
    setForgotLoading(true);
    try {
      const res = await fetch('/api/hr/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', email: forgotEmail.trim(), code: forgotCode.trim(), newPassword: forgotPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setForgotError(json.error ?? 'Could not restore access. Please try again.'); return; }
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

  const primaryBtn: React.CSSProperties = {
    width: '100%', height: 60, borderRadius: 16, border: 'none',
    background: `linear-gradient(135deg, ${ORANGE} 0%, #F08A3C 100%)`,
    color: '#fff', fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 8px 22px -8px rgba(232,119,34,0.48)',
  };
  const linkBtn: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: ORANGE, background: 'none',
    border: 'none', cursor: 'pointer', padding: 0,
  };
  const errorBox: React.CSSProperties = {
    fontSize: 13.5, fontWeight: 500, padding: '13px 16px', borderRadius: 14,
    background: '#FEF2F2', color: '#B42318', border: '1px solid #FECDCA',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#fff' }}>

      {/* ══ LEFT: 40% ══ */}
      <aside
        className="hidden lg:flex"
        style={{
          position: 'relative', width: '40%', flexShrink: 0,
          flexDirection: 'column', justifyContent: 'space-between',
          padding: '52px 56px',
          background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_2} 100%)`,
        }}
      >
        <BrandBackdrop />

        {/* Logo lockup */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leadway-health-logo-light.png" alt="Leadway Health" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
          <div style={{ width: 1, height: 38, background: 'rgba(255,255,255,0.16)' }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>Corporate Portal</p>
            <p style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.52)', marginTop: 2 }}>
              Enterprise Healthcare Management
            </p>
          </div>
        </div>

        {/* Headline + features */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div>
            <p style={{
              fontSize: 11.5, fontWeight: 700, color: ORANGE,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20,
            }}>
              Powering healthier workplaces
            </p>
            <h1 style={{
              fontSize: 46, fontWeight: 700, color: '#fff',
              lineHeight: 1.14, letterSpacing: '-0.025em', marginBottom: 20,
            }}>
              Smart health<br />management for<br /><span style={{ color: ORANGE }}>your people.</span>
            </h1>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, maxWidth: 460 }}>
              A unified platform for HR and Finance teams to manage corporate healthcare
              with complete visibility, operational efficiency and real-time insights.
            </p>
          </div>

          {/* Four feature cards: dark glass */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
            {[
              { icon: Users,     title: 'Manage Members',        desc: 'Add, update and manage employees.' },
              { icon: BarChart3, title: 'Performance Analytics', desc: 'Monitor utilization, claims and loss ratio.' },
              { icon: Hospital,  title: 'Provider Network',      desc: 'Access accredited providers nationwide.' },
              { icon: FileText,  title: 'Finance & Reports',     desc: 'Invoices, reports and scheme performance.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{
                padding: '18px 18px 20px', borderRadius: 20,
                background: 'rgba(255,255,255,0.045)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 2px 14px -6px rgba(0,0,0,0.35)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, marginBottom: 13,
                  background: 'rgba(232,119,34,0.14)', border: '1px solid rgba(232,119,34,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon style={{ width: 17, height: 17, color: ORANGE }} strokeWidth={2} />
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', marginBottom: 5 }}>{title}</p>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Security statement */}
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <LockIcon style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.72)', flexShrink: 0 }} strokeWidth={2.2} />
            {['Secure', 'Reliable', 'Always Available'].map((t, i) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>
                {i > 0 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.32)' }} />}
                {t}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.34)' }}>
            © 2026 Leadway Health Limited
          </p>
        </div>
      </aside>

      {/* ══ RIGHT: 60% ══ */}
      <main style={{
        position: 'relative', flex: 1, minWidth: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fff', padding: '32px 40px', overflowY: 'auto',
      }}>
        {/* Dotted gradient, top right */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, right: 0, width: 420, height: 420, opacity: 0.6,
          backgroundImage: 'radial-gradient(#D7DBE3 1.15px, transparent 1.15px)',
          backgroundSize: '17px 17px',
          maskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 100% 0%, #000 0%, transparent 70%)',
        }} />

        {/* Floating login card */}
        <div className="rise-in" style={{
          position: 'relative', width: '100%', maxWidth: 720,
          background: '#fff', borderRadius: 28, border: `1px solid ${BORDER}`,
          boxShadow: '0 24px 64px -20px rgba(26,26,46,0.16), 0 8px 20px -12px rgba(26,26,46,0.08)',
          padding: '48px 56px 42px',
        }}>

          {/* Pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 99,
            background: 'rgba(232,119,34,0.07)', border: '1px solid rgba(232,119,34,0.22)',
            marginBottom: 24,
          }}>
            <ShieldCheck style={{ width: 13.5, height: 13.5, color: ORANGE }} strokeWidth={2.2} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: ORANGE, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Secure HR Sign-In
            </span>
          </div>

          {forgotStep ? (
            <>
              <h2 style={{ fontSize: 32, fontWeight: 700, color: INK, letterSpacing: '-0.025em', marginBottom: 8 }}>
                {forgotStep === 'done' ? 'Access restored' : 'Restore your access'}
              </h2>
              <p style={{ fontSize: 14.5, fontWeight: 500, color: MUTED, marginBottom: 32 }}>
                {forgotStep === 'email' && 'Enter your account email and we’ll send you a code.'}
                {forgotStep === 'reset' && <>Enter the code sent to <strong style={{ color: INK, fontWeight: 600 }}>{forgotEmail}</strong>, then your Leadway Health password.</>}
                {forgotStep === 'done' && 'Your portal sign-in now matches your Leadway Health password.'}
              </p>

              {forgotStep === 'email' && (
                <form onSubmit={handleForgotRequest} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  <div>
                    <label htmlFor="forgot-email" style={LABEL}>Email address</label>
                    <Field icon={Mail}>
                      <input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                        required autoFocus placeholder="you@company.com" style={INPUT} />
                    </Field>
                  </div>
                  {forgotError && <div role="alert" style={errorBox}>{forgotError}</div>}
                  <button type="submit" disabled={forgotLoading} className="btn-lift"
                    style={{ ...primaryBtn, opacity: forgotLoading ? 0.7 : 1, cursor: forgotLoading ? 'not-allowed' : 'pointer' }}>
                    {forgotLoading ? 'Sending...' : <>Send code <ArrowRight style={{ width: 17, height: 17 }} /></>}
                  </button>
                  <button type="button" onClick={closeForgot} style={{ ...linkBtn, color: MUTED, textAlign: 'center' }}>
                    ← Back to sign in
                  </button>
                </form>
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={handleForgotReset} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {forgotInfo && (
                    <div style={{ ...errorBox, background: '#ECFDF3', color: '#027A48', border: '1px solid #A6F4C5' }}>{forgotInfo}</div>
                  )}
                  <div>
                    <label htmlFor="forgot-code" style={LABEL}>Emailed code</label>
                    <input id="forgot-code" type="text" inputMode="numeric" value={forgotCode} autoFocus required
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="field-ring"
                      style={{ ...FIELD, ...INPUT, width: '100%', height: 62, fontSize: 26, fontWeight: 700, letterSpacing: '0.34em', textAlign: 'center' }} />
                  </div>
                  <div>
                    <label htmlFor="forgot-pass" style={LABEL}>Your Leadway Health password</label>
                    <Field icon={Lock} trailing={
                      <button type="button" onClick={() => setForgotShowPass(!forgotShowPass)}
                        aria-label={forgotShowPass ? 'Hide password' : 'Show password'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: FAINT, padding: 0, display: 'flex' }}>
                        {forgotShowPass ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                      </button>
                    }>
                      <input id="forgot-pass" type={forgotShowPass ? 'text' : 'password'} value={forgotPassword}
                        onChange={(e) => setForgotPassword(e.target.value)} required autoComplete="new-password"
                        placeholder="••••••••" style={INPUT} />
                    </Field>
                    <p style={{ fontSize: 12, fontWeight: 500, color: FAINT, marginTop: 8 }}>
                      Sign-in is checked against Leadway Health every time, so the portal cannot set a password of
                      its own. Enter the password Leadway Health holds for you and the portal will match it.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="forgot-confirm" style={LABEL}>Confirm password</label>
                    <Field icon={Lock}>
                      <input id="forgot-confirm" type={forgotShowPass ? 'text' : 'password'} value={forgotConfirm}
                        onChange={(e) => setForgotConfirm(e.target.value)} required autoComplete="new-password"
                        placeholder="••••••••" style={INPUT} />
                    </Field>
                  </div>
                  {forgotError && <div role="alert" style={errorBox}>{forgotError}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button type="button" onClick={() => setForgotStep('email')} style={{ ...linkBtn, color: MUTED }}>← Back</button>
                    <button type="button" onClick={handleForgotRequest} disabled={forgotLoading} style={linkBtn}>
                      {forgotLoading ? 'Sending...' : 'Resend code'}
                    </button>
                  </div>
                  <button type="submit" disabled={forgotLoading} className="btn-lift"
                    style={{ ...primaryBtn, opacity: forgotLoading ? 0.7 : 1, cursor: forgotLoading ? 'not-allowed' : 'pointer' }}>
                    {forgotLoading ? 'Checking...' : <>Restore access <ArrowRight style={{ width: 17, height: 17 }} /></>}
                  </button>
                </form>
              )}

              {forgotStep === 'done' && (
                <button type="button" onClick={() => { closeForgot(); setPassword(''); }} className="btn-lift" style={primaryBtn}>
                  ← Back to sign in
                </button>
              )}
            </>
          ) : (
          <>
            <h2 style={{ fontSize: 34, fontWeight: 700, color: INK, letterSpacing: '-0.027em', marginBottom: 8 }}>
              {otpStep ? 'Two-factor verification' : 'Welcome back'}
            </h2>
            <p style={{ fontSize: 14.5, fontWeight: 500, color: MUTED, marginBottom: 32 }}>
              {otpStep
                ? <>Enter the 6-digit code we sent to <strong style={{ color: INK, fontWeight: 600 }}>{email}</strong>.</>
                : 'Sign in to access your corporate health portal.'}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {!otpStep && (
                <div>
                  <label htmlFor="email" style={LABEL}>Email address</label>
                  <Field icon={Mail}>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      required autoComplete="username" placeholder="you@company.com" style={INPUT} />
                  </Field>
                </div>
              )}

              {!otpStep && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label htmlFor="password" style={{ ...LABEL, marginBottom: 0 }}>Password</label>
                    <button type="button" onClick={openForgot} style={linkBtn}>Forgot password?</button>
                  </div>
                  <Field icon={Lock} trailing={
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: FAINT, padding: 0, display: 'flex' }}>
                      {showPassword ? <EyeOff style={{ width: 17, height: 17 }} /> : <Eye style={{ width: 17, height: 17 }} />}
                    </button>
                  }>
                    <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                      onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                      placeholder="••••••••" style={INPUT} />
                  </Field>
                </div>
              )}

              {otpStep && (
                <div>
                  <label htmlFor="otp" style={LABEL}>One-time passcode</label>
                  <input id="otp" type="text" inputMode="numeric" value={otp} autoFocus required
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="field-ring"
                    style={{ ...FIELD, ...INPUT, width: '100%', height: 62, fontSize: 26, fontWeight: 700, letterSpacing: '0.34em', textAlign: 'center' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                    <button type="button" onClick={() => { setOtpStep(false); setOtp(''); setError(''); }} style={{ ...linkBtn, color: MUTED }}>
                      ← Back
                    </button>
                    <button type="button" onClick={handleResend} disabled={resending} style={linkBtn}>
                      {resending ? 'Sending...' : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}

              {error && <div role="alert" style={errorBox}>{error}</div>}

              <button type="submit" disabled={isLoading || (otpStep && otp.length < 6)} className="btn-lift"
                style={{ ...primaryBtn, opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}>
                {isLoading ? (
                  <>
                    <svg style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in...
                  </>
                ) : otpStep
                  ? <>Verify &amp; sign in <ArrowRight style={{ width: 17, height: 17 }} /></>
                  : <>Sign In <ArrowRight style={{ width: 17, height: 17 }} /></>}
              </button>
            </form>

            {!otpStep && (
              <>
                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '26px 0 22px' }}>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: FAINT, letterSpacing: '0.08em' }}>OR</span>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                </div>

                <a href="/admin/login" className="btn-outline-lift"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    width: '100%', height: 56, borderRadius: 16, boxSizing: 'border-box',
                    border: `1px solid ${BORDER}`, background: '#fff',
                    color: INK, fontSize: 14.5, fontWeight: 600, textDecoration: 'none',
                  }}>
                  <Building2 style={{ width: 17, height: 17, color: INK }} strokeWidth={2} />
                  Leadway Staff Login
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </a>

                {/* Support card */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 24,
                  padding: '18px 20px', borderRadius: 20,
                  background: '#F7F8FA', border: `1px solid ${BORDER}`,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: 'rgba(232,119,34,0.09)', border: '1px solid rgba(232,119,34,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Headphones style={{ width: 17, height: 17, color: ORANGE }} strokeWidth={2} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: INK, marginBottom: 3 }}>Need help signing in?</p>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: MUTED, lineHeight: 1.55 }}>
                      Contact your scheme administrator or the Leadway Health support team.
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
          )}

          {/* Trust indicators */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
            marginTop: 28, paddingTop: 22, borderTop: `1px solid ${BORDER}`, flexWrap: 'wrap',
          }}>
            {[
              { icon: LockIcon,   label: '256-bit Encrypted' },
              { icon: BadgeCheck, label: 'ISO 27001 Compliant' },
              { icon: ShieldHalf, label: 'Enterprise Secure' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 500, color: FAINT }}>
                <Icon style={{ width: 14, height: 14 }} strokeWidth={1.9} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

        </div>
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
