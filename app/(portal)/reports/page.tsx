'use client';

import { useState } from 'react';
import { ArrowDownToLine, Users, Activity, Search, Building2, CreditCard } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

const reports = [
  { id: 1, title: 'Membership Report',   desc: 'Active lives · Additions · Removals',        icon: Users,      lastGen: '22 Jun 2026' },
  { id: 2, title: 'Utilization Report',  desc: 'Claims count · Amount · Visits',             icon: Activity,   lastGen: '22 Jun 2026' },
  { id: 3, title: 'Claims Analysis',     desc: 'Top diagnoses · Providers · Categories',     icon: Search,     lastGen: '20 Jun 2026' },
  { id: 4, title: 'Provider Utilization',desc: 'Visits by provider · Spend by provider',    icon: Building2,  lastGen: '20 Jun 2026' },
  { id: 5, title: 'Financial Report',    desc: 'Invoices · Payments · Outstanding balances', icon: CreditCard, lastGen: '18 Jun 2026' },
];

export default function ReportsPage() {
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [plan, setPlan] = useState('');

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Insights" subtitle="Reports &amp; Analytics" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 20 }}>
<div className="flex items-end gap-3 flex-wrap">
            <div><p className="text-[11px] text-[#9CA3B8] font-medium mb-1">From</p><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none focus:border-[#F56B22]" /></div>
            <div><p className="text-[11px] text-[#9CA3B8] font-medium mb-1">To</p><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none focus:border-[#F56B22]" /></div>
            <div><p className="text-[11px] text-[#9CA3B8] font-medium mb-1">Plan</p><select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none focus:border-[#F56B22]"><option value="">All Plans</option><option>Gold Plus</option><option>Silver</option><option>Bronze</option></select></div>
            <button className="h-9 px-5 text-[12px] font-semibold text-white rounded-xl" style={{ background: '#F56B22' }}>Apply</button>
            <button className="h-9 px-4 text-[12px] font-medium text-[#6B7280] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA]">Reset</button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {reports.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 20, transition: 'box-shadow 0.15s' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#FFF3E8]"><Icon className="w-5 h-5 text-[#F56B22]" strokeWidth={1.75} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#131C4E]">{r.title}</p>
                  <p className="text-[12px] text-[#9CA3B8] mt-0.5">{r.desc}</p>
                </div>
                <p className="text-[11px] text-[#9CA3B8] flex-shrink-0 hidden md:block">Last generated: {r.lastGen}</p>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 13px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }}>
                    <ArrowDownToLine style={{ width: 12, height: 12 }} /> XLS
                  </button>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 13px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', background: 'linear-gradient(135deg,#FFF5EF,#FFE8D6)', color: '#C2410C', border: '1px solid #FDBA74', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(194,65,12,0.10)' }}>
                    <ArrowDownToLine style={{ width: 12, height: 12 }} /> PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
