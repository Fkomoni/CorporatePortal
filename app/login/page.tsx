'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, BarChart3, Users, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
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

  return (
    <div className="flex h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ backgroundColor: '#131C4E' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L4 6V11C4 15.42 7.05 19.55 11 20.93C14.95 19.55 18 15.42 18 11V6L11 2Z" fill="white" fillOpacity="0.9"/>
              <path d="M9.5 11H7.5V9H9.5V7H11.5V9H13.5V11H11.5V13H9.5V11Z" fill="#F56B22"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">Leadway Health</p>
            <p className="text-xs font-medium" style={{ color: '#7B82AA' }}>Corporate Portal</p>
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">Your scheme.<br />Your data.<br />Your decisions.</h1>
            <p className="text-base" style={{ color: '#A8AECB' }}>A powerful portal built for HR and Finance teams to manage your corporate health scheme with full visibility and control.</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245, 107, 34, 0.15)' }}>
                <ShieldCheck className="w-4 h-4" style={{ color: '#F56B22' }} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Full Benefit Transparency</p>
                <p className="text-xs mt-0.5" style={{ color: '#7B82AA' }}>View and manage all benefit plans and coverage details for every employee</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245, 107, 34, 0.15)' }}>
                <BarChart3 className="w-4 h-4" style={{ color: '#F56B22' }} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Real-Time Analytics</p>
                <p className="text-xs mt-0.5" style={{ color: '#7B82AA' }}>Monitor utilization, loss ratio, and claims data as it happens</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(245, 107, 34, 0.15)' }}>
                <Users className="w-4 h-4" style={{ color: '#F56B22' }} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Seamless Member Management</p>
                <p className="text-xs mt-0.5" style={{ color: '#7B82AA' }}>Add, update, and terminate members with a few clicks</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs" style={{ color: '#3A4382' }}>© 2024 Leadway Health Limited. All rights reserved.</p>
      </div>
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 2L4 6V11C4 15.42 7.05 19.55 11 20.93C14.95 19.55 18 15.42 18 11V6L11 2Z" fill="white" fillOpacity="0.9"/>
                <path d="M9.5 11H7.5V9H9.5V7H11.5V9H13.5V11H11.5V13H9.5V11Z" fill="#F56B22"/>
              </svg>
            </div>
            <p className="font-bold text-lg" style={{ color: '#131C4E' }}>Leadway Health</p>
          </div>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#131C4E' }}>Welcome back</h2>
            <p className="text-sm" style={{ color: '#3A4382' }}>Sign in to your corporate portal account</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#131C4E' }}>Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chidi.nwosu@acmecorp.com" required
                className="w-full h-11 px-4 text-sm rounded-lg border outline-none transition-all" style={{ borderColor: '#E5E7F1', color: '#131C4E' }}
                onFocus={(e) => { e.target.style.borderColor = '#F56B22'; e.target.style.boxShadow = '0 0 0 3px rgba(245,107,34,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E5E7F1'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: '#131C4E' }}>Password</label>
                <button type="button" className="text-xs font-medium hover:underline" style={{ color: '#F56B22' }}>Forgot password?</button>
              </div>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full h-11 px-4 pr-11 text-sm rounded-lg border outline-none transition-all" style={{ borderColor: '#E5E7F1', color: '#131C4E' }}
                  onFocus={(e) => { e.target.style.borderColor = '#F56B22'; e.target.style.boxShadow = '0 0 0 3px rgba(245,107,34,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E5E7F1'; e.target.style.boxShadow = 'none'; }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <div className="text-sm rounded-lg px-4 py-3" style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={isLoading}
              className="w-full h-11 rounded-lg text-white font-semibold text-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)' }}>
              {isLoading ? (<><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Signing in...</>) : 'Sign In'}
            </button>
          </form>
          <p className="text-xs text-center mt-8" style={{ color: '#7B82AA' }}>Protected by Leadway Health security. Your data is encrypted and secure.</p>
        </div>
      </div>
    </div>
  );
}
