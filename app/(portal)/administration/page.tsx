'use client';

import { useState } from 'react';
import { Plus, Download, Phone, Mail } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockUsers } from '@/lib/mock-data';

const roleColors: Record<string, { bg: string; text: string }> = {
  'Admin':      { bg: '#FFF1E6', text: '#F56B22' },
  'HR Manager': { bg: '#EEF2FF', text: '#3730A3' },
  'Finance':    { bg: '#FFFBEB', text: '#D97706' },
  'Viewer':     { bg: '#F1F5F9', text: '#475569' },
};

const faqs = [
  'How do I add a new member to the scheme?',
  'How do I download e-cards in bulk?',
  'What is the waiting period for maternity benefits?',
  'How do I dispute a claim?',
  "How do I change a member's plan?",
];

const downloads = [
  { name: 'Member Upload Template', type: 'Excel', updated: 'Jun 2026' },
  { name: 'Provider List',          type: 'Excel', updated: 'Jun 2026' },
  { name: 'User Guide',             type: 'PDF',   updated: 'v1.2' },
  { name: 'Benefit Guide',          type: 'PDF',   updated: '2026 Edition' },
];

export default function AdministrationPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'help'>('users');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar title="Administration" subtitle="Users &amp; Access · Help &amp; Downloads" />
      <div className="p-6 flex flex-col gap-5">
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#F0F1F5] shadow-sm w-fit">
          {(['users', 'help'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab ? 'text-white' : 'text-[#6B7280] hover:text-[#131C4E]'}`}
              style={activeTab === tab ? { background: '#131C4E' } : {}}>
              {tab === 'users' ? 'Users & Access' : 'Help & Downloads'}
            </button>
          ))}
        </div>
        {activeTab === 'users' && (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { role: 'Admin',      desc: 'Full access to all modules', icon: '👑' },
                { role: 'HR Manager', desc: 'Members · Benefits · Reports · Requests', icon: '🧑‍💼' },
                { role: 'Finance',    desc: 'Finance module & Finance Reports only', icon: '💳' },
                { role: 'Viewer',     desc: 'View only · No edits or submissions', icon: '👁️' },
              ].map((r) => {
                const c = roleColors[r.role] ?? { bg: '#F1F5F9', text: '#475569' };
                return (
                  <div key={r.role} className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F1F5]">
                    <div className="flex items-center gap-2 mb-2"><span className="text-[18px]">{r.icon}</span><span className="inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: c.bg, color: c.text }}>{r.role}</span></div>
                    <p className="text-[12px] text-[#9CA3B8]">{r.desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F5] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F0F1F5]">
                <p className="text-[14px] font-bold text-[#131C4E]">Portal Users <span className="text-[#9CA3B8] font-normal text-[12px]">— {mockUsers.length} active</span></p>
                <button className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold text-white rounded-xl" style={{ background: '#F56B22' }}><Plus className="w-3.5 h-3.5" /> Invite User</button>
              </div>
              {mockUsers.map((u, i) => {
                const rc = roleColors[u.role] ?? { bg: '#F1F5F9', text: '#475569' };
                const gradients = ['linear-gradient(135deg,#F56B22,#FFB54B)', 'linear-gradient(135deg,#131C4E,#3A4382)', 'linear-gradient(135deg,#10B981,#059669)', 'linear-gradient(135deg,#8B5CF6,#6D28D9)'];
                return (
                  <div key={u.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[12px] flex-shrink-0" style={{ background: gradients[i % gradients.length] }}>{u.name.split(' ').map((w: string) => w[0]).join('')}</div>
                    <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-[#131C4E]">{u.name}</p><p className="text-[11px] text-[#9CA3B8]">{u.email}</p></div>
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: rc.bg, color: rc.text }}>{u.role}</span>
                    <span className="text-[11px] text-[#9CA3B8] w-28 text-right">Last login: today</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#ECFDF5] text-[#059669]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>
                    <div className="flex gap-1">
                      <button className="h-7 px-3 text-[11px] font-medium border border-[#E5E7F1] rounded-lg hover:bg-[#F7F8FA] text-[#6B7280]">Edit</button>
                      <button className="h-7 px-3 text-[11px] font-medium border border-[#E5E7F1] rounded-lg hover:bg-[#FEF2F2] text-[#9CA3B8] hover:text-[#DC2626]">Disable</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {activeTab === 'help' && (
          <div className="grid grid-cols-3 gap-5">
            <div className="col-span-2 flex flex-col gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F5] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F1F5]"><p className="text-[14px] font-bold text-[#131C4E]">Download Centre</p></div>
                {downloads.map((d) => (
                  <div key={d.name} className="flex items-center gap-4 px-5 py-4 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F1F2F8] flex-shrink-0"><Download className="w-4 h-4 text-[#3A4382]" /></div>
                    <div className="flex-1"><p className="text-[13px] font-semibold text-[#131C4E]">{d.name}</p><p className="text-[11px] text-[#9CA3B8]">{d.type} · Updated {d.updated}</p></div>
                    <button className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-semibold text-white rounded-lg" style={{ background: '#F56B22' }}><Download className="w-3 h-3" /> Download</button>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F5] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F1F5]"><p className="text-[14px] font-bold text-[#131C4E]">Frequently Asked Questions</p></div>
                {faqs.map((q, i) => (
                  <div key={i} className="border-b border-[#F7F8FA] last:border-0">
                    <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAFBFC] transition-colors" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      <span className="text-[13px] font-semibold text-[#131C4E]">{q}</span>
                      <span className={`text-[#9CA3B8] transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    {openFaq === i && <div className="px-5 pb-4 text-[12px] text-[#9CA3B8] leading-relaxed">Please refer to the User Guide or contact your account manager for detailed instructions on this topic.</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg,#131C4E,#3A4382)' }}>
                <p className="text-[13px] font-bold mb-1">Your Account Manager</p>
                <p className="text-[11px] text-white/50 mb-4">Dedicated support for your scheme</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center font-bold text-[13px]">SO</div>
                  <div><p className="text-[14px] font-bold">Samuel Okafor</p><p className="text-[11px] text-white/50">Corporate Account Manager</p></div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-[12px]"><Phone className="w-3.5 h-3.5 text-white/50" />+234 800 532 9374</div>
                  <div className="flex items-center gap-2 text-[12px]"><Mail className="w-3.5 h-3.5 text-white/50" />s.okafor@leadway.com</div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 h-9 text-[12px] font-semibold bg-white/15 border border-white/20 rounded-xl hover:bg-white/25 transition-colors">📞 Call</button>
                  <button className="flex-1 h-9 text-[12px] font-semibold bg-white text-[#131C4E] rounded-xl hover:bg-white/90 transition-colors">✉ Email</button>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
                <p className="text-[13px] font-bold text-[#131C4E] mb-3">Contact Leadway Health</p>
                <div className="space-y-3">
                  <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-[#F1F2F8] flex items-center justify-center flex-shrink-0"><Phone className="w-3.5 h-3.5 text-[#3A4382]" /></div><div><p className="text-[12px] font-semibold text-[#131C4E]">Customer Care</p><p className="text-[11px] text-[#9CA3B8]">0800-LEADWAY</p></div></div>
                  <div className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-[#F1F2F8] flex items-center justify-center flex-shrink-0"><Mail className="w-3.5 h-3.5 text-[#3A4382]" /></div><div><p className="text-[12px] font-semibold text-[#131C4E]">Corporate Email</p><p className="text-[11px] text-[#9CA3B8]">corporate@leadwayhealth.com</p></div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
