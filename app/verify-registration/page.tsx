'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyRegistrationPage() {
  const router = useRouter();

  const [code, setCode]             = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/hr/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationcode: code.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Verification failed. Please check your code and try again.');
      } else {
        setSuccess(true);
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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #131C4E 0%, #1E2D72 50%, #2A3A8C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F56B22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '-0.04em' }}>LH</div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>LEADWAY</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', marginTop: -2 }}>HEALTH HMO</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', boxShadow: '0 24px 80px rgba(0,0,0,0.28)' }}>

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 26 }}>✓</div>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#131C4E', marginBottom: 8 }}>Account Verified!</p>
              <p style={{ fontSize: 13, color: '#9CA3B8', lineHeight: 1.6 }}>
                Your password has been set successfully.<br />Redirecting you to login…
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', marginBottom: 6 }}>Verify Registration</p>
                <p style={{ fontSize: 13, color: '#9CA3B8', lineHeight: 1.5 }}>
                  Enter the verification code sent to your email and create your new password.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter the code from your email"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    style={{ ...inputStyle, letterSpacing: '0.1em', fontWeight: 700 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7 }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
                  />
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#EF4444', fontWeight: 500 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !code || !password || !confirm}
                  style={{ height: 50, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || !code || !password || !confirm) ? 0.6 : 1, boxShadow: '0 4px 14px rgba(245,107,34,0.36)', marginTop: 4, transition: 'opacity 0.15s' }}>
                  {loading ? 'Verifying…' : 'Verify & Set Password'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9CA3B8' }}>
                Already have an account?{' '}
                <button onClick={() => router.push('/login')} style={{ background: 'none', border: 'none', color: '#F56B22', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          © 2025 Leadway Health HMO. All rights reserved.
        </p>
      </div>
    </div>
  );
}
