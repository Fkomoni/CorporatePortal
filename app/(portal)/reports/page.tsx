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
      <TopBar title="Insights & Reports" subtitle="Analytics · Exports · Trends" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'From', type: 'date', value: from, onChange: setFrom },
              { label: 'To',   type: 'date', value: to,   onChange: setTo },
            ].map(({ label, type, value, onChange }) => (
              <div key={label}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</p>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  style={{ height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
                />
              </div>
            ))}
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Plan</p>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
              >
                <option value="">All Plans</option>
                <option>Plus Plan</option>
                <option>Pro Plan</option>
                <option>Max Plan</option>
                <option>Promax Plan</option>
                <option>Magnum Plan</option>
              </select>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button
                style={{ height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', whiteSpace: 'nowrap' }}
              >
                Apply
              </button>
              <button
                onClick={() => { setFrom('2026-01-01'); setTo('2026-06-30'); setPlan(''); }}
                style={{ height: 42, padding: '0 18px', fontSize: 13, fontWeight: 500, color: '#6B7280', border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {reports.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 20, transition: 'box-shadow 0.15s' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon style={{ width: 22, height: 22, color: '#F56B22' }} strokeWidth={1.75} /></div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.01em' }}>{r.title}</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 3 }}>{r.desc}</p>
                </div>
                <p style={{ fontSize: 11, color: '#C4C9D9', flexShrink: 0 }} className="hidden md:block">Last generated: <span style={{ color: '#9CA3B8', fontWeight: 600 }}>{r.lastGen}</span></p>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 13px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }}>
                    <ArrowDownToLine style={{ width: 12, height: 12 }} /> XLS
                  </button>
                  <button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 32, padding: '0 13px', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', background: 'linear-gradient(135deg,#FFF5EF,#FFE8D6)', color: '#C2410C', border: '1px solid #FDBA74', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 3px rgba(194,65,12,0.10)' }}>
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
