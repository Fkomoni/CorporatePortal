'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { isAdminRole, canAccessModule, moduleForPath } from '@/lib/roles';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  Lightbulb,
  MessageSquare,
  Settings,
  FileText,
  ChevronDown,
  LogOut,
  Heart,
  UserCheck,
  ClipboardList,
  ClipboardCheck,
  Building2,
  CalendarDays,
} from 'lucide-react';

// Grouped so the sidebar reads as sections rather than one long list. Wellness
// and Pre-employment are kept under SERVICES: they aren't in the design's
// groups, but both are working pages and dropping them from the nav would be
// the only way to reach them gone.
const NAV_GROUPS: Array<{
  section: string;
  items: Array<{ href: string; label: string; icon: React.ElementType; badge?: number; adminOnly?: boolean }>;
}> = [
  {
    section: 'Dashboard',
    items: [{ href: '/dashboard', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    section: 'Membership',
    items: [
      { href: '/members', label: 'People', icon: Users },
      { href: '/pending-enrolees', label: 'Pending Enrolments', icon: ClipboardCheck, adminOnly: true },
      { href: '/benefits', label: 'Benefits', icon: ShieldCheck },
    ],
  },
  {
    section: 'Finance',
    items: [
      { href: '/finance', label: 'Finance', icon: CreditCard },
      { href: '/claims', label: 'Claims', icon: FileText },
    ],
  },
  {
    section: 'Analytics',
    items: [{ href: '/reports', label: 'Insights & Reports', icon: Lightbulb }],
  },
  {
    section: 'Services',
    items: [
      { href: '/wellness', label: 'Wellness', icon: Heart },
      { href: '/pre-employment', label: 'Pre-employment', icon: UserCheck },
    ],
  },
  {
    section: 'Support',
    items: [{ href: '/service-desk', label: 'Service Desk', icon: MessageSquare, badge: 4 }],
  },
  {
    section: 'Administration',
    items: [
      { href: '/audit-logs', label: 'Audit Log', icon: ClipboardList, adminOnly: true },
      { href: '/administration', label: 'Administration', icon: Settings },
    ],
  },
];

function NavLink({ href, label, icon: Icon, badge, isActive }: {
  href: string; label: string; icon: React.ElementType;
  badge?: number; isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center"
      style={{
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        margin: '0 12px',
        background: isActive ? 'linear-gradient(135deg,#F56B22,#E85D10)' : 'transparent',
        boxShadow: isActive ? '0 2px 10px rgba(245,107,34,0.35)' : 'none',
        textDecoration: 'none',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon
        style={{ width: 18, height: 18, flexShrink: 0, color: isActive ? '#fff' : '#8B93B5' }}
        strokeWidth={isActive ? 2.2 : 1.8}
      />
      <span className="flex-1 truncate" style={{
        fontSize: 13.5,
        fontWeight: isActive ? 700 : 500,
        color: isActive ? '#fff' : '#C2C8DE',
      }}>
        {label}
      </span>
      {badge !== undefined && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 20, height: 20, padding: '0 6px',
          borderRadius: 99, fontSize: 10.5, fontWeight: 800,
          background: isActive ? 'rgba(255,255,255,0.25)' : '#F56B22',
          color: '#fff', flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName: string = user?.companyName ?? 'Corporate';
  const companyId: string = user?.companyId ?? '';
  const userName: string = session?.user?.name ?? '';
  const userRole: string = user?.role ?? 'HR Administrator';
  const roleLabel = userRole === 'hr_admin' ? 'HR Administrator' : userRole;

  const initials = (value: string) => value
    .split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  // Policy period and headcount for the client chip. dashboard-stats is cached
  // server-side, so this is cheap even though the sidebar is on every page.
  const [policyPeriod, setPolicyPeriod] = useState<string | null>(null);
  const [activeLives, setActiveLives] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/hr/dashboard-stats')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.stats) return;
        setPolicyPeriod(d.stats.policyPeriod ?? null);
        setActiveLives(typeof d.stats.activeLives === 'number' ? d.stats.activeLives : null);
      })
      .catch(() => { /* the chip just omits these lines */ });
    return () => { cancelled = true; };
  }, []);

  const isActive = (href: string) =>
    pathname === href || (pathname?.startsWith(href + '/') ?? false);

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[240px] flex flex-col z-40"
      style={{ background: '#101A44' }}
    >
      {/* Logo — knockout variant so the wordmark reads on navy. */}
      <div style={{ padding: '18px 16px 14px' }}>
        <Image
          src="/leadway-health-logo-light.png"
          alt="Leadway Health"
          width={1178}
          height={390}
          style={{ objectFit: 'contain', objectPosition: 'left center', width: 'auto', height: 34, display: 'block' }}
          priority
        />
        <p style={{ fontSize: 11.5, color: '#8B93B5', marginTop: 8 }}>Corporate Portal</p>
      </div>

      {/* Client chip — company, plan, policy period and headcount at a glance. */}
      <div style={{
        margin: '4px 12px 18px', padding: '12px 13px', borderRadius: 12,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 style={{ width: 15, height: 15, color: '#F56B22' }} />
          </div>
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', lineHeight: 1.3, wordBreak: 'break-word' }}>
              {companyName}
            </p>
            <p style={{ fontSize: 10.5, color: '#8B93B5', marginTop: 2 }}>{companyId || '—'}</p>
          </div>
          <ChevronDown style={{ width: 13, height: 13, color: '#8B93B5', flexShrink: 0, marginTop: 2 }} />
        </div>

        {(policyPeriod || activeLives != null) && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '11px 0 9px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {policyPeriod && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarDays style={{ width: 12, height: 12, color: '#8B93B5', flexShrink: 0 }} />
                  <p style={{ fontSize: 10.5, color: '#C2C8DE' }}>{policyPeriod}</p>
                </div>
              )}
              {activeLives != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users style={{ width: 12, height: 12, color: '#8B93B5', flexShrink: 0 }} />
                  <p style={{ fontSize: 10.5, color: '#C2C8DE' }}>{activeLives.toLocaleString()} members</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 overflow-y-auto" style={{ paddingBottom: 8 }}>
        {NAV_GROUPS.map((group) => {
          const items = group.items
            .filter((item) => !item.adminOnly || isAdminRole(userRole))
            .filter((item) => {
              const mod = moduleForPath(item.href);
              return !mod || canAccessModule(userRole, mod);
            });
          if (items.length === 0) return null;
          return (
            <div key={group.section} style={{ marginBottom: 16 }}>
              <p style={{
                fontSize: 10, fontWeight: 700, color: '#6C769E',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '0 24px', marginBottom: 8,
              }}>
                {group.section}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {items.map(({ adminOnly: _adminOnly, ...item }) => (
                  <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User chip */}
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', borderRadius: 12,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#F56B22,#FF8C4B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 11,
          }}>
            {initials(userName) || 'U'}
          </div>
          <div style={{ flex: '1 1 0%', minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', lineHeight: 1.3 }} className="truncate">
              {userName || 'User'}
            </p>
            <p style={{ fontSize: 10.5, color: '#8B93B5', marginTop: 1 }} className="truncate">{roleLabel}</p>
          </div>
          <button
            title="Log out"
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.20)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          >
            <LogOut style={{ width: 13, height: 13, color: '#FCA5A5' }} strokeWidth={2} />
          </button>
        </div>

        <p style={{ fontSize: 9.5, color: '#5A6390', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          © {new Date().getFullYear()} Leadway Health Limited.<br />All rights reserved.
        </p>
      </div>
    </aside>
  );
}
