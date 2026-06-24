'use client';

import { useState } from 'react';
import { Plus, Paperclip, Search, MessageSquare, X } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockTickets } from '@/lib/mock-data';
import { useToast } from '@/components/ui/Toast';

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Open':            { bg: '#FEF2F2', text: '#DC2626',  dot: '#EF4444' },
  'In Progress':     { bg: '#FFFBEB', text: '#D97706',  dot: '#F59E0B' },
  'Awaiting Client': { bg: '#EFF6FF', text: '#2563EB',  dot: '#3B82F6' },
  'Awaiting Leadway':{ bg: '#F5F3FF', text: '#7C3AED',  dot: '#8B5CF6' },
  'Closed':          { bg: '#F1F5F9', text: '#475569',  dot: '#94A3B8' },
};

const slaColors: Record<string, { bg: string; text: string }> = {
  'Within SLA': { bg: '#ECFDF5', text: '#059669' },
  'Near SLA':   { bg: '#FFFBEB', text: '#D97706' },
  'Breached':   { bg: '#FEF2F2', text: '#DC2626' },
  'Closed':     { bg: '#F1F5F9', text: '#94A3B8' },
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  'Enrolment': { bg: '#EFF6FF', text: '#2563EB' },
  'Claims':    { bg: '#FFF7ED', text: '#C2410C' },
  'Benefits':  { bg: '#EEF2FF', text: '#3730A3' },
  'General':   { bg: '#F1F5F9', text: '#475569' },
  'Billing':   { bg: '#FFFBEB', text: '#D97706' },
  'Provider':  { bg: '#FFF1F2', text: '#BE123C' },
};

const mockSLA = ['Within SLA', 'Within SLA', 'Near SLA', 'Within SLA', 'Breached', 'Within SLA', 'Near SLA', 'Closed'];

const summaryItems = [
  { label: 'Open',             value: 4,  color: '#EF4444', bg: '#FEF2F2' },
  { label: 'In Progress',      value: 6,  color: '#D97706', bg: '#FFFBEB' },
  { label: 'Awaiting Leadway', value: 2,  color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Awaiting Client',  value: 1,  color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Closed',           value: 28, color: '#64748B', bg: '#F1F5F9' },
];

export default function ServiceDeskPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const filtered = mockTickets.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.ticketId.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
  });

  function handleSubmit() {
    setShowForm(false);
    toast('Request submitted — our team will respond within 24 hours.');
  }

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Service Desk" subtitle="Ticket Management · SLA Tracking" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* SUMMARY CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          {summaryItems.map((s) => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', borderLeft: `3px solid ${s.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '22px 22px 22px 20px' }}>
              <p style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: '#131C4E', letterSpacing: '-0.03em', marginBottom: 10 }}>{s.value}</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* SEARCH + ACTION BAR */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 480 }}>
            <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#C4C9D9' }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket ID, subject, or category..."
              style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', whiteSpace: 'nowrap' }}>
            <Plus style={{ width: 16, height: 16 }} /> New Request
          </button>
        </div>

        {/* TICKET TABLE */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 160px 110px 100px 100px', columnGap: 12, padding: '12px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            {['Ticket ID', 'Subject', 'Category', 'Status', 'SLA', 'Submitted', 'Updated'].map((h) => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {filtered.map((t, i) => {
            const s   = statusColors[t.status]     ?? statusColors['Closed'];
            const cat = categoryColors[t.category]  ?? categoryColors['General'];
            const slaKey = mockSLA[i] ?? 'Within SLA';
            const sla = slaColors[slaKey] ?? slaColors['Within SLA'];
            return (
              <div key={t.id}
                style={{ display: 'grid', gridTemplateColumns: '110px 1fr 140px 160px 110px 100px 100px', columnGap: 12, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F7F8FA', cursor: 'pointer', transition: 'background 0.12s' }}
                className="hover:bg-[#FAFBFC] last:border-0">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', fontFamily: 'monospace' }}>{t.ticketId}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 16 }}>{t.subject}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: cat.bg, color: cat.text, width: 'fit-content' }}>
                  {t.category}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: s.bg, color: s.text, width: 'fit-content' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  {t.status}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: sla.bg, color: sla.text, width: 'fit-content' }}>
                  {slaKey}
                </span>
                <span style={{ fontSize: 11, color: '#9CA3B8' }}>{new Date(t.submittedDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}</span>
                <span style={{ fontSize: 11, color: '#9CA3B8' }}>{new Date(t.lastUpdated).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}</span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare style={{ width: 20, height: 20, color: '#9CA3B8' }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E' }}>No tickets found</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>Try adjusting your search term</p>
              </div>
            </div>
          )}
        </div>

        {/* NEW REQUEST MODAL */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', width: '100%', maxWidth: 520 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>New Request</p>
                <button onClick={() => setShowForm(false)} style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3B8' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Category</label>
                  <select style={{ width: '100%', height: 42, padding: '0 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#F7F8FA', color: '#131C4E', outline: 'none' }}>
                    <option value="">Select category...</option>
                    {Object.keys(categoryColors).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Subject</label>
                  <input style={{ width: '100%', height: 42, padding: '0 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#F7F8FA', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }} placeholder="Brief description..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Details</label>
                  <textarea style={{ width: '100%', height: 96, padding: '10px 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#F7F8FA', color: '#131C4E', outline: 'none', resize: 'none', boxSizing: 'border-box' }} placeholder="Describe your request..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Attachments</label>
                  <div style={{ border: '2px dashed #E5E7F1', borderRadius: 12, padding: '20px 16px', textAlign: 'center', background: '#FAFBFC', cursor: 'pointer' }}>
                    <Paperclip style={{ width: 20, height: 20, color: '#9CA3B8', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: '#9CA3B8' }}>Drop files here or <span style={{ color: '#F56B22', fontWeight: 600 }}>browse</span></p>
                    <p style={{ fontSize: 10, color: '#C4C9D9', marginTop: 4 }}>Excel · PDF · PNG · JPG</p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #F0F1F5' }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 500, color: '#6B7280', border: '1px solid #E5E7F1', borderRadius: 12, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSubmit} style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 8px rgba(245,107,34,0.28)' }}>Submit Request</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
