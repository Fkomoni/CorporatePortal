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
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await signIn('hr-credentials', {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError('Invalid email or password. Please try again.');
    } else {
      router.push('/dashboard');
      router.refresh();
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

          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#131C4E', marginBottom: 6 }}>Welcome back</h2>
          <p style={{ fontSize: 14, color: '#6B7480', marginBottom: 32 }}>Sign in to manage your corporate health scheme.</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

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

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Password
                </label>
                <button type="button" style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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
                  Signing in…
                </>
              ) : 'Sign in to Corporate Portal →'}
            </button>
          </form>

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
