'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, Bell, HelpCircle } from 'lucide-react';

interface TopBarProps {
  /** Page heading. Omit on pages whose content carries its own heading (dashboard). */
  title?: string;
  subtitle?: string;
  /** Count on the bell. Omit when there is nothing to report. */
  notificationCount?: number;
}

export function TopBar({ title, subtitle, notificationCount }: TopBarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userName: string = (session?.user as any)?.name ?? '';
  const initials = userName
    .split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  // ⌘K / Ctrl-K focuses search: the shortcut the field advertises, so it has to
  // actually work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Search sends you to People with the term applied, which is where member,
  // ID and phone lookups actually resolve.
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/members?q=${encodeURIComponent(q)}`);
  };

  const iconButton: React.CSSProperties = {
    position: 'relative', width: 38, height: 38, borderRadius: '50%',
    border: '1px solid #EDEEF2', background: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  return (
    <header
      className="flex items-center flex-shrink-0"
      style={{ background: '#F7F8FC', height: 84, padding: '0 30px', gap: 16 }}
    >
      <div className="flex-1 min-w-0">
        {title && (
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.02em', lineHeight: 1.2 }} className="truncate">
            {title}
          </h1>
        )}
        {subtitle && <p style={{ fontSize: 13, color: '#9CA3B8', marginTop: 4 }} className="truncate">{subtitle}</p>}
      </div>

      <div className="flex items-center" style={{ gap: 10 }}>
        <form onSubmit={submitSearch} className="relative hidden sm:block">
          {/* A real submit button, not a decorative icon. It looks like the
              obvious way to run the search, so it has to actually do it -
              pressing Enter was previously the only way. */}
          <button
            type="submit"
            aria-label="Search"
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 22, height: 22, padding: 0, border: 'none', background: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Search style={{ width: 15, height: 15, color: '#9CA3B8' }} />
          </button>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members, ID or phone..."
            style={{
              height: 42, width: 320, paddingLeft: 40, paddingRight: 58,
              fontSize: 13, borderRadius: 12, border: '1px solid #EDEEF2',
              background: '#fff', color: '#131C4E', outline: 'none', boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#EDEEF2'; }}
          />
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 10.5, fontWeight: 700, color: '#B0B7C9',
            background: '#F7F8FC', border: '1px solid #EDEEF2', borderRadius: 6,
            padding: '3px 6px', pointerEvents: 'none',
          }}>
            ⌘K
          </span>
        </form>

        <button
          type="button"
          title={notificationCount ? `${notificationCount} awaiting your review` : 'Notifications'}
          onClick={() => router.push('/pending-enrolees')}
          style={iconButton}
        >
          <Bell style={{ width: 17, height: 17, color: '#6B7480' }} strokeWidth={1.8} />
          {notificationCount != null && notificationCount > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18,
              padding: '0 5px', borderRadius: 99, background: '#F56B22', color: '#fff',
              fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center',
              justifyContent: 'center', border: '2px solid #F7F8FC',
            }}>
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>

        <button
          type="button"
          title="Help & support"
          onClick={() => router.push('/service-desk')}
          style={iconButton}
        >
          <HelpCircle style={{ width: 17, height: 17, color: '#6B7480' }} strokeWidth={1.8} />
        </button>

        <div
          title={userName || undefined}
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#F56B22,#FF8C4B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 13,
          }}
        >
          {initials || 'U'}
        </div>
      </div>
    </header>
  );
}
