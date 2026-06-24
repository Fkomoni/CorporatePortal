'use client';

import { Search, Plus, Upload, Download } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  showQuickActions?: boolean;
}

export function TopBar({ title, subtitle, showQuickActions = false }: TopBarProps) {
  return (
    <header className="bg-white border-b border-[#F0F1F5] h-[58px] flex items-center px-9 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-bold text-[#131C4E] truncate leading-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-[#9CA3B8] leading-none mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {showQuickActions && (
          <>
            <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-lg hover:bg-[#F7F8FA] transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload Census
            </button>
            <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#3A4382] border border-[#E5E7F1] rounded-lg hover:bg-[#F7F8FA] transition-colors">
              <Download className="w-3.5 h-3.5" /> Download Invoice
            </button>
            <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white rounded-lg transition-colors" style={{ background: '#F56B22' }}>
              <Plus className="w-3.5 h-3.5" /> Add Member
            </button>
          </>
        )}
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3B8]" />
          <input type="text" placeholder="Search..." className="h-8 pl-8 pr-3 text-[12px] rounded-lg border border-[#E5E7F1] bg-[#F7F8FA] text-[#131C4E] placeholder:text-[#9CA3B8] outline-none focus:border-[#F56B22] focus:bg-white transition-colors w-44" />
        </div>
      </div>
    </header>
  );
}
