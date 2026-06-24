'use client';

import { useState } from 'react';
import { Plus, ArrowDownToLine, Phone, Mail } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockUsers } from '@/lib/mock-data';

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  'Admin':      { bg: '#FFF1E6', text: '#F56B22', border: '#FFD8C0' },
  'HR Manager': { bg: '#EEF2FF', text: '#3730A3', border: '#C7D2FE' },
  'Finance':    { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  'Viewer':     { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
};

const roleCards = [
  { role: 'Admin',      desc: 'Full access to all modules' },
  { role: 'HR Manager', desc: 'Members · Benefits · Reports · Requests' },
  { role: 'Finance',    desc: 'Finance module & Finance Reports only' },
  { role: 'Viewer',     desc: 'View only · No edits or submissions' },
];

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

  const card = {
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #EDEEF2',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Administration" subtitle="Users & Access · Help & Downloads" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {(['users', 'help'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: '9px 22px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: activeTab === tab ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                color: activeTab === tab ? '#fff' : '#6B7280',
                boxShadow: activeTab === tab ? '0 2px 8px rgba(245,107,34,0.28)' : 'none',
              }}>
              {tab === 'users' ? 'Users & Access' : 'Help & Downloads'}
            </button>
          ))}
        </div>

        {activeTab === 'users' && (
          <>
            {/* ROLE CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {roleCards.map((r) => {
                const c = roleColors[r.role] ?? roleColors['Viewer'];
                return (
                  <div key={r.role} style={{ ...card, padding: '22px 22px 22px 20px', borderLeft: `3px solid ${c.text}` }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 6 }}>{r.role}</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.6 }}>{r.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* USERS TABLE */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Portal Users</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>{mockUsers.length} active users</p>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)' }}>
                  <Plus style={{ width: 15, height: 15 }} /> Invite User
                </button>
              </div>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 140px 160px 130px', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                {['User', 'Role', 'Last Login', 'Status', ''].map((h) => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>

              {mockUsers.map((u) => {
                const rc = roleColors[u.role] ?? roleColors['Viewer'];
                return (
                  <div key={u.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 180px 140px 160px 130px', columnGap: 12, alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #F7F8FA', transition: 'background 0.12s' }}
                    className="last:border-0 hover:bg-[#FAFBFC]">
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{u.name}</p>
                      <p style={{ fontSize: 11, color: '#B8BFD0', marginTop: 2 }}>{u.email}</p>
                    </div>
                    <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: rc.bg, color: rc.text, width: 'fit-content' }}>
                      {u.role}
                    </span>
                    <span style={{ fontSize: 12, color: '#9CA3B8' }}>Today</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#ECFDF5', color: '#059669', width: 'fit-content' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                      Active
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ height: 30, padding: '0 12px', fontSize: 11, fontWeight: 500, color: '#3A4382', border: '1px solid #E5E7F1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Edit</button>
                      <button style={{ height: 30, padding: '0 12px', fontSize: 11, fontWeight: 500, color: '#9CA3B8', border: '1px solid #E5E7F1', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Disable</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'help' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* DOWNLOADS */}
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Download Centre</p>
                </div>
                {downloads.map((d) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderBottom: '1px solid #F7F8FA', transition: 'background 0.12s' }} className="last:border-0 hover:bg-[#FAFBFC]">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: d.type === 'Excel' ? '#F0FDF4' : '#FFF5EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowDownToLine style={{ width: 16, height: 16, color: d.type === 'Excel' ? '#15803D' : '#C2410C' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{d.name}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>{d.type} · Updated {d.updated}</p>
                    </div>
                    <button style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                      ...(d.type === 'Excel'
                        ? { background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', boxShadow: '0 1px 3px rgba(21,128,61,0.10)' }
                        : { background: 'linear-gradient(135deg,#FFF5EF,#FFE8D6)', color: '#C2410C', border: '1px solid #FDBA74', boxShadow: '0 1px 3px rgba(194,65,12,0.10)' }),
                    }}>
                      <ArrowDownToLine style={{ width: 11, height: 11 }} /> {d.type === 'Excel' ? 'XLS' : 'PDF'}
                    </button>
                  </div>
                ))}
              </div>

              {/* FAQS */}
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Frequently Asked Questions</p>
                </div>
                {faqs.map((q, i) => (
                  <div key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                    <button
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{q}</span>
                      <span style={{ color: '#9CA3B8', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 12 }}>▾</span>
                    </button>
                    {openFaq === i && (
                      <div style={{ padding: '0 24px 16px', fontSize: 12, color: '#9CA3B8', lineHeight: 1.6 }}>
                        Please refer to the User Guide or contact your account manager for detailed instructions on this topic.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SIDEBAR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ borderRadius: 16, padding: '22px 24px', color: '#fff', background: 'linear-gradient(135deg,#131C4E,#3A4382)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Your Account Manager</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Dedicated support for your scheme</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>SO</div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>Samuel Okafor</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Corporate Account Manager</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><Phone style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)' }} />+234 800 532 9374</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><Mail style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)' }} />s.okafor@leadway.com</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, height: 38, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, color: '#fff', cursor: 'pointer' }}>📞 Call</button>
                  <button style={{ flex: 1, height: 38, fontSize: 12, fontWeight: 600, background: '#fff', border: 'none', borderRadius: 10, color: '#131C4E', cursor: 'pointer' }}>✉ Email</button>
                </div>
              </div>

              <div style={{ ...card, padding: '22px 24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 16 }}>Contact Leadway Health</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Phone style={{ width: 14, height: 14, color: '#3A4382' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>Customer Care</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>0800-LEADWAY</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Mail style={{ width: 14, height: 14, color: '#3A4382' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>Corporate Email</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>corporate@leadwayhealth.com</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
