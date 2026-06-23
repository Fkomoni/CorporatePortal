'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  Lightbulb,
  MessageSquare,
  Settings,
  LogOut,
  Building2,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

const navItems = [
  { href: '/dashboard',       label: 'Overview',       icon: LayoutDashboard },
  { href: '/members',         label: 'People',          icon: Users },
  { href: '/benefits',        label: 'Benefits',        icon: ShieldCheck },
  { href: '/finance',         label: 'Finance',         icon: CreditCard },
  { href: '/reports',         label: 'Insights',        icon: Lightbulb },
  { href: '/service-desk',    label: 'Service Desk',    icon: MessageSquare, badge: 4 },
  { href: '/administration',  label: 'Administration',  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] flex flex-col z-40 bg-white border-r border-[#F0F1F5]">
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-[#F0F1F5]">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)' }}
        >
          <ShieldCheck className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[#131C4E] font-bold text-[13px] leading-tight">Leadway Health</p>
          <p className="text-[10px] text-[#9CA3B8] font-medium">Corporate Portal</p>
        </div>
      </div>

      <div className="mx-3 mt-3 mb-1 rounded-lg px-3 py-2 bg-[#F7F8FA] border border-[#F0F1F5]">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-[#9CA3B8] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#131C4E] truncate">Dangote Industries</p>
            <p className="text-[10px] text-[#9CA3B8]">ACM-2026</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={twMerge(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-[#FFF1E6] text-[#F56B22] font-semibold'
                    : 'text-[#6B7280] hover:text-[#131C4E] hover:bg-[#F7F8FA]'
                )}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0"
                  strokeWidth={isActive ? 2.25 : 1.75}
                  style={{ color: isActive ? '#F56B22' : undefined }}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[#F56B22] text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-[#F0F1F5]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
            style={{ background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)' }}
          >
            AF
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#131C4E] truncate">Amaka Fashola</p>
            <p className="text-[10px] text-[#9CA3B8]">HR Administrator</p>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-[#F7F8FA] text-[#9CA3B8] hover:text-[#6B7280] transition-colors" title="Sign out">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
