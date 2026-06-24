'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Palette, LogOut } from 'lucide-react';

const navItems = [
  { label: 'Corporates', href: '/admin/corporates', Icon: LayoutGrid },
  { label: 'Templates',  href: '/admin/templates',  Icon: Palette },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #F0F1F5', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 40 }}>

      {/* LOGO */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F0F1F5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em' }}>LH</span>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 900, color: '#131C4E', lineHeight: 1.2, letterSpacing: '-0.02em' }}>LEADWAY</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#F56B22', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>Health HMO</p>
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FFF1E6', borderRadius: 6, padding: '3px 8px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F56B22', flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#F56B22', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Admin Console</span>
        </div>
      </div>

      {/* NAV */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ label, href, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, borderLeft: active ? '3px solid #F56B22' : '3px solid transparent', background: active ? '#FFF5EF' : 'transparent', cursor: 'pointer', transition: 'all 0.12s' }}>
                <Icon style={{ width: 16, height: 16, color: active ? '#F56B22' : '#9CA3B8', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#F56B22' : '#6B7280' }}>{label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #F0F1F5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#131C4E,#3A4382)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 }}>G</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', lineHeight: 1.3 }}>Gideon</p>
            <p style={{ fontSize: 10, color: '#9CA3B8' }}>Leadway Admin</p>
          </div>
        </div>
        <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid #EDEEF2', background: '#F7F8FC', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6B7280' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#FECACA'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#F7F8FC'; e.currentTarget.style.borderColor = '#EDEEF2'; e.currentTarget.style.color = '#6B7280'; }}>
          <LogOut style={{ width: 13, height: 13 }} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
