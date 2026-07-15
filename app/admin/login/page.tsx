'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldCheck, Building2, BarChart3, Users, LayoutGrid, Briefcase } from 'lucide-react';

type Stage = 'credentials' | 'otp';
type Destination = 'console' | 'client';

interface ClientOption { companyId: string; companyName: string | null }

export default function StaffLoginPage() {
  const [stage, setStage] = useState<Stage>('credentials');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(true);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [destination, setDestination] = useState<Destination>('console');
  const [companyId, setCompanyId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/staff/request-login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: login, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Invalid credentials. Please check your Leadway staff email and password.');
        return;
      }
      const linkedClients: ClientOption[] = json.clients ?? [];
      setClients(linkedClients);
      setDestination(linkedClients.length > 0 ? 'client' : 'console');
      setCompanyId(linkedClients.length === 1 ? linkedClients[0].companyId : '');
      setOtpRequired(json.otpRequired !== false);
      setStage('otp');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const effectiveCompanyId = destination === 'client' ? companyId : '';
    if (destination === 'client' && !effectiveCompanyId) {
      setIsLoading(false);
      setError('Select which client you want to manage.');
      return;
    }

    const result = await signIn('staff-credentials', {
      email: login,
      password,
      otp,
      companyId: effectiveCompanyId,
      redirect: false,
    });

    if (result?.error) {
      setIsLoading(false);
      setError('Invalid or expired code. Please try again.');
      return;
    }

    if (rememberDevice) {
      try {
        const trustRes = await fetch('/api/staff/trust-device', { method: 'POST' });
        if (!trustRes.ok) console.error('[login] trust-device call failed', trustRes.status, await trustRes.text());
      } catch (err) {
        console.error('[login] trust-device call errored', err);
      }
    }

    setIsLoading(false);
    router.push(effectiveCompanyId ? '/dashboard' : '/admin/corporates');
    router.refresh();
  };

  const fi = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#F56B22';
    e.target.style.boxShadow = '0 0 0 3px rgba(245,107,34,0.10)';
  };
  const fo = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#E5E7F1';
    e.target.style.boxShadow = 'none';
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
              Corporate Portal · Staff Access
            </p>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 16 }}>
              Manage clients.<br />Drive outcomes.
            </h1>
            <p style={{ fontSize: 15, color: '#A8AECB', lineHeight: 1.6 }}>
              End to end Underwriting, Claims, Provider Network, Fraud & Abuse, and Member Support: one system of record.
            </p>
          </div>

          {/* Feature bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Building2,  title: 'All Corporate Accounts',   desc: 'View and manage every client scheme from a single dashboard.' },
              { icon: Users,      title: 'Member-Level Visibility',  desc: 'Search any member across all clients instantly.' },
              { icon: BarChart3,  title: 'Live Utilisation Data',    desc: 'Real-time claims, loss ratios, and benefit usage per scheme.' },
              { icon: ShieldCheck,title: 'Portal Settings Control',  desc: 'Toggle module access for each corporate HR portal.' },
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

          {/* Secure sign-in badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, background: '#FFF5EF', border: '1px solid rgba(245,107,34,0.2)', marginBottom: 20 }}>
            <ShieldCheck style={{ width: 13, height: 13, color: '#F56B22' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F56B22', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Secure Staff Sign-In</span>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 32 }}>
            {stage === 'credentials'
              ? 'Sign in with your Leadway staff email and Active Directory password.'
              : `Enter the code sent to ${login}, and select which client you're managing.`}
          </p>

          {stage === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Staff Email or Username
              </label>
              <input
                type="text" value={login} onChange={(e) => setLogin(e.target.value)}
                placeholder="firstname.lastname@leadway.com" required autoComplete="username"
                style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={fi} onBlur={fo}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Password
              </label>
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
              <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 6 }}>
                Your usual Leadway Active Directory password (this portal never sets or resets it).
              </p>
            </div>

            {error && (
              <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading}
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
                  Verifying…
                </>
              ) : 'Continue →'}
            </button>
          </form>
          )}

          {stage === 'otp' && (
          <form onSubmit={handleOtpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {otpRequired ? (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                One-Time Passcode
              </label>
              <input
                type="text" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456" required
                style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 14, letterSpacing: '0.3em', border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={fi} onBlur={fo}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, color: '#6B7480', cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                Remember this device for 45 days
              </label>
            </div>
            ) : (
              <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                Device recognized: no code needed. Just pick where you&apos;re going below.
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                Where are you going?
              </label>
              <div style={{ display: 'flex', gap: 8, padding: 4, background: '#F0F1F5', borderRadius: 12, marginBottom: 12 }}>
                <button type="button" onClick={() => setDestination('console')}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    height: 40, borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                    background: destination === 'console' ? '#fff' : 'transparent',
                    color: destination === 'console' ? '#131C4E' : '#9CA3B8',
                    boxShadow: destination === 'console' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  <LayoutGrid style={{ width: 14, height: 14 }} /> Staff Console
                </button>
                <button type="button" onClick={() => setDestination('client')} disabled={clients.length === 0}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    height: 40, borderRadius: 9, border: 'none', cursor: clients.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 700,
                    background: destination === 'client' ? '#fff' : 'transparent',
                    color: destination === 'client' ? '#131C4E' : '#9CA3B8',
                    boxShadow: destination === 'client' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    opacity: clients.length === 0 ? 0.5 : 1,
                  }}>
                  <Briefcase style={{ width: 14, height: 14 }} /> Client HR Desk
                </button>
              </div>

              {destination === 'console' && (
                <p style={{ fontSize: 12, color: '#6B7480', lineHeight: 1.6 }}>
                  Platform administration: manage corporates, portal settings, audit logs, and who has Client HR Desk access.
                </p>
              )}

              {destination === 'client' && (
                clients.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#B0B7C9' }}>
                    You&apos;re not linked to any client yet; ask an administrator to grant access.
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: '#6B7480', marginBottom: 10, lineHeight: 1.6 }}>
                      Sign in as HR for one of your linked clients.
                    </p>
                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                      style={{ width: '100%', height: 44, padding: '0 14px', fontSize: 14, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">Select a client…</option>
                      {clients.map((c) => (
                        <option key={c.companyId} value={c.companyId}>{c.companyName || c.companyId}</option>
                      ))}
                    </select>
                  </>
                )
              )}
            </div>

            {error && (
              <div style={{ fontSize: 13, padding: '12px 16px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading || (otpRequired && otp.length < 4) || (destination === 'client' && !companyId)}
              style={{
                width: '100%', height: 46, borderRadius: 10, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #F56B22 0%, #FF8C4B 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                opacity: (isLoading || (otpRequired && otp.length < 4) || (destination === 'client' && !companyId)) ? 0.55 : 1,
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
              ) : 'Sign in to Corporate Portal →'}
            </button>

            <button type="button" onClick={() => { setStage('credentials'); setOtp(''); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#9CA3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              ← Back
            </button>
          </form>
          )}

          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 28, color: '#B8BFD0' }}>
            Protected by Leadway Health security. Access is monitored and logged.
          </p>

          {/* Link to HR login */}
          <p style={{ fontSize: 12, textAlign: 'center', marginTop: 12, color: '#B8BFD0' }}>
            Not a Leadway staff member?{' '}
            <a href="/login" style={{ color: '#F56B22', fontWeight: 600, textDecoration: 'none' }}>
              HR portal login →
            </a>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
