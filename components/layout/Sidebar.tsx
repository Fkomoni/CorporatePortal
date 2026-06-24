'use client';

import { usePathname } from 'next/navigation';
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
  LogOut,
  FileText,
  ChevronDown,
} from 'lucide-react';

const mainNav = [
  { href: '/dashboard',    label: 'Overview',    icon: LayoutDashboard },
  { href: '/members',      label: 'People',       icon: Users },
  { href: '/benefits',     label: 'Benefits',     icon: ShieldCheck },
  { href: '/finance',      label: 'Finance',      icon: CreditCard },
  { href: '/reports',      label: 'Insights',     icon: Lightbulb },
  { href: '/claims',       label: 'Claims',       icon: FileText },
  { href: '/service-desk', label: 'Service Desk', icon: MessageSquare, badge: 4 },
];

const bottomNav = [
  { href: '/administration', label: 'Administration', icon: Settings },
];

function NavLink({ href, label, icon: Icon, badge, isActive }: {
  href: string; label: string; icon: React.ElementType;
  badge?: number; isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center group"
      style={{
        gap: 12,
        padding: '11px 14px',
        borderRadius: 12,
        margin: '0 8px',
        background: isActive
          ? 'linear-gradient(135deg, #FFF3E8 0%, #FFF8F2 100%)'
          : 'transparent',
        boxShadow: isActive ? '0 1px 6px rgba(245,107,34,0.10)' : 'none',
        border: isActive ? '1px solid rgba(245,107,34,0.12)' : '1px solid transparent',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = '#F7F8FC';
          e.currentTarget.style.border = '1px solid #EDEEF2';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.border = '1px solid transparent';
        }
      }}
    >
      <Icon
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          color: isActive ? '#F56B22' : '#A8B0C2',
          transition: 'color 0.15s',
        }}
        strokeWidth={isActive ? 2.1 : 1.7}
      />
      <span
        className="flex-1 truncate"
        style={{
          fontSize: 14,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? '#F56B22' : '#6B7480',
          letterSpacing: isActive ? '-0.01em' : '0',
          transition: 'color 0.15s',
        }}
      >
        {label}
      </span>
      {badge !== undefined && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 20, height: 20, padding: '0 5px',
          borderRadius: 99, fontSize: 10.5, fontWeight: 700,
          background: isActive ? '#F56B22' : '#F56B22',
          color: '#fff',
          boxShadow: '0 1px 4px rgba(245,107,34,0.35)',
        }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[220px] flex flex-col z-40"
      style={{ background: '#fff', borderRight: '1px solid #EDEEF2' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4"
        style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #EDEEF2' }}
      >
        <Image
          src="/leadway-logo.jpeg"
          alt="Leadway Health"
          width={120}
          height={40}
          style={{ objectFit: 'contain', objectPosition: 'left center', height: 36, width: 'auto' }}
          priority
        />
      </div>

      {/* Client chip */}
      <div
        className="mx-3 mt-4 mb-2 cursor-pointer"
        style={{
          background: '#F7F8FC',
          borderRadius: 10,
          border: '1px solid #EDEEF2',
          padding: '9px 12px',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg,#131C4E,#3A4382)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 10,
          }}>
            DI
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', lineHeight: '1.3' }} className="truncate">
              Dangote Industries
            </p>
            <p style={{ fontSize: 10, color: '#B8BFD0', marginTop: 1 }}>ACM-2026</p>
          </div>
          <ChevronDown style={{ width: 13, height: 13, color: '#C8CDD9', flexShrink: 0 }} />
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto" style={{ paddingTop: 6, paddingBottom: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
          ))}
        </div>

        {/* Divider */}
        <div style={{ margin: '12px 16px', height: 1, background: '#F0F1F6' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {bottomNav.map((item) => (
            <NavLink key={item.href} {...item} isActive={isActive(item.href)} />
          ))}
        </div>
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid #EDEEF2', padding: '14px 16px' }}>
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)',
            boxShadow: '0 2px 8px rgba(245,107,34,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 11,
          }}>
            AF
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 12.5, fontWeight: 600, color: '#131C4E', lineHeight: '1.2' }} className="truncate">
              Amaka Fashola
            </p>
            <p style={{ fontSize: 10, color: '#B8BFD0', marginTop: 2 }}>HR Administrator</p>
          </div>
          <button
            style={{ padding: 7, borderRadius: 8, color: '#C8CDD9', background: 'transparent', transition: 'all 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F8FC'; e.currentTarget.style.color = '#7C8499'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C8CDD9'; }}
            title="Sign out"
          >
            <LogOut style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </aside>
  );
}
