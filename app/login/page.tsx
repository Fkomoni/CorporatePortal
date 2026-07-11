'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, BarChart3, Users, FileText } from 'lucide-react';

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

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* ── Left panel ── */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          width: '50%', padding: '44px 52px', background: '#131C4E',
        }}
        className="hidden lg:flex"
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff', flexShrink: 0 }}>LH</div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>Leadway Health</p>
            <p style={{ fontSize: 11, color: '#7B82AA', marginTop: 1 }}>Corporate Portal</p>
          </div>
        </div>

        {/* Hero copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
              Corporate Portal — HR Access
            </p>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16 }}>
              Your scheme.<br />Your data.<br />Your decisions.
            </h1>
            <p style={{ fontSize: 15, color: '#A8AECB', lineHeight: 1.6 }}>
              A powerful portal built for HR and Finance teams to manage your corporate health scheme with full visibility and control.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: ShieldCheck, title: 'Full Benefit Transparency',   desc: 'View and manage all benefit plans and coverage details for every employee.' },
              { icon: BarChart3,   title: 'Real-Time Analytics',         desc: 'Monitor utilization, loss ratio, and claims data as it happens.' },
              { icon: Users,       title: 'Seamless Member Management',  desc: 'Add, update, and terminate members with a few clicks.' },
              { icon: FileText,    title: 'Pre-employment Screening',    desc: 'Initiate and track medical screenings for new hires.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,107,34,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 16, height: 16, color: '#F56B22' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{title}</p>
                  <p style={{ fontSize: 12, color: '#7B82AA', marginTop: 2, lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#3A4382' }}>© 2026 Leadway Health Limited. All rights reserved.</p>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }} className="lg:hidden">
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#fff' }}>LH</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E' }}>Leadway Health</p>
              <p style={{ fontSize: 11, color: '#9CA3B8' }}>Corporate Portal</p>
            </div>
          </div>

          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: '#FFF5EF', border: '1px solid rgba(245,107,34,0.2)', marginBottom: 20 }}>
            <ShieldCheck style={{ width: 13, height: 13, color: '#F56B22' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F56B22', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Secure HR Sign-In</span>
          </div>

          {forgotStep ? (
            <>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>
                {forgotStep === 'done' ? 'Password reset' : 'Reset your password'}
              </h2>
              <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 32 }}>
                {forgotStep === 'email' && 'Enter your account email and we\'ll send you a reset code.'}
                {forgotStep === 'reset' && <>Enter the code sent to <strong style={{ color: '#131C4E' }}>{forgotEmail}</strong> and choose a new password.</>}
                {forgotStep === 'done' && 'Your password has been reset. You can now sign in with your new password.'}
              </p>

              {forgotStep === 'email' && (
                <form onSubmit={handleForgotRequest} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                      Email Address
                    </label>
                    <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoFocus
                      placeholder="chidi.nwosu@acmecorp.com"
                      style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={fi} onBlur={fo} />
                  </div>
                  {forgotError && (
                    <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>{forgotError}</div>
                  )}
                  <button type="submit" disabled={forgotLoading}
                    style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: forgotLoading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #F56B22 0%, #FF8C4B 100%)', color: '#fff', fontSize: 14, fontWeight: 700, opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Sending…' : 'Send Reset Code →'}
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
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                      Reset Code
                    </label>
                    <input type="text" inputMode="numeric" value={forgotCode} autoFocus
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000" required
                      style={{ width: '100%', height: 52, padding: '0 14px', fontSize: 24, fontWeight: 700, letterSpacing: '0.35em', textAlign: 'center', border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={fi} onBlur={fo} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                      New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input type={forgotShowPass ? 'text' : 'password'} value={forgotPassword} onChange={(e) => setForgotPassword(e.target.value)}
                        placeholder="••••••••" required autoComplete="new-password"
                        style={{ width: '100%', height: 44, padding: '0 44px 0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={fi} onBlur={fo} />
                      <button type="button" onClick={() => setForgotShowPass(!forgotShowPass)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B8BFD0', padding: 0, display: 'flex' }}>
                        {forgotShowPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 6 }}>Min 8 characters, with uppercase, lowercase, a number and a special character.</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                      Confirm New Password
                    </label>
                    <input type={forgotShowPass ? 'text' : 'password'} value={forgotConfirm} onChange={(e) => setForgotConfirm(e.target.value)}
                      placeholder="••••••••" required autoComplete="new-password"
                      style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={fi} onBlur={fo} />
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
                    style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: forgotLoading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #F56B22 0%, #FF8C4B 100%)', color: '#fff', fontSize: 14, fontWeight: 700, opacity: forgotLoading ? 0.7 : 1 }}>
                    {forgotLoading ? 'Resetting…' : 'Reset Password →'}
                  </button>
                </form>
              )}

              {forgotStep === 'done' && (
                <button type="button" onClick={() => { closeForgot(); setPassword(''); }}
                  style={{ width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #F56B22 0%, #FF8C4B 100%)', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                  ← Back to Sign In
                </button>
              )}
            </>
          ) : (
          <>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>{otpStep ? 'Two-factor verification' : 'Welcome back'}</h2>
          <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 32 }}>
            {otpStep
              ? <>Enter the 6-digit code we sent to <strong style={{ color: '#131C4E' }}>{email}</strong>.</>
              : 'Sign in to manage your corporate health scheme.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {!otpStep && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Email Address
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="chidi.nwosu@acmecorp.com" required autoComplete="username"
                style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={fi} onBlur={fo}
              />
            </div>
            )}

            {!otpStep && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Password
                </label>
                <button type="button" onClick={openForgot} style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ width: '100%', height: 44, padding: '0 44px 0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={fi} onBlur={fo}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B8BFD0', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </div>
            )}

            {otpStep && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                One-Time Passcode
              </label>
              <input
                type="text" inputMode="numeric" value={otp} autoFocus
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" required
                style={{ width: '100%', height: 52, padding: '0 14px', fontSize: 24, fontWeight: 700, letterSpacing: '0.35em', textAlign: 'center', border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
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
              style={{
                width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #F56B22 0%, #FF8C4B 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                opacity: isLoading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 2px 12px rgba(245,107,34,0.30)',
                marginTop: 4,
              }}>
              {isLoading ? (
                <>
                  <svg style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : otpStep ? 'Verify & Sign In →' : 'Sign in to Corporate Portal →'}
            </button>
          </form>
          </>
          )}

          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 28, color: '#B8BFD0' }}>
            Protected by Leadway Health security. Your data is encrypted and secure.
          </p>

          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 12, color: '#B8BFD0' }}>
            Leadway staff?{' '}
            <a href="/admin/login" style={{ color: '#F56B22', fontWeight: 600, textDecoration: 'none' }}>
              Staff portal login →
            </a>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
