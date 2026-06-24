'use client';

import { useState } from 'react';
import { Plus, Paperclip, Search, MessageSquare } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockTickets } from '@/lib/mock-data';
import { useToast } from '@/components/ui/Toast';

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Open':           { bg: '#FEF2F2', text: '#DC2626',  dot: '#EF4444' },
  'In Progress':    { bg: '#FFFBEB', text: '#D97706',  dot: '#F59E0B' },
  'Awaiting Client':{ bg: '#EFF6FF', text: '#2563EB',  dot: '#3B82F6' },
  'Awaiting Leadway':{ bg: '#F5F3FF', text: '#7C3AED', dot: '#8B5CF6' },
  'Closed':         { bg: '#F1F5F9', text: '#475569',  dot: '#94A3B8' },
};

const slaColors: Record<string, { bg: string; text: string }> = {
  'Within SLA': { bg: '#ECFDF5', text: '#059669' },
  'Near SLA':   { bg: '#FFFBEB', text: '#D97706' },
  'Breached':   { bg: '#FEF2F2', text: '#DC2626' },
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
  { label: 'Open',             value: 4,  color: '#EF4444' },
  { label: 'In Progress',      value: 6,  color: '#F59E0B' },
  { label: 'Awaiting Leadway', value: 2,  color: '#8B5CF6' },
  { label: 'Awaiting Client',  value: 1,  color: '#3B82F6' },
  { label: 'Closed',           value: 28, color: '#94A3B8' },
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

        {/* SUMMARY + ACTION */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {summaryItems.map((s) => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '18px 24px', textAlign: 'center', minWidth: 100 }}>
              <p style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: s.color, letterSpacing: '-0.03em' }}>{s.value}</p>
              <p style={{ fontSize: 11, fontWeight: 500, color: '#9CA3B8', marginTop: 6 }}>{s.label}</p>
            </div>
          ))}
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3B8]" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="h-10 pl-9 pr-3 w-[220px] text-[13px] border border-[#E5E7F1] rounded-xl bg-white text-[#131C4E] placeholder:text-[#9CA3B8] outline-none focus:border-[#F56B22] transition-colors" />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 h-10 px-5 text-[13px] font-semibold text-white rounded-xl"
            style={{ background: '#F56B22' }}>
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>

        {/* TICKET TABLE */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div className="grid text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest px-5 py-3 bg-[#FAFBFC] border-b border-[#F0F1F5]"
            style={{ gridTemplateColumns: '100px 1fr 150px 130px 100px 100px 100px', columnGap: 8 }}>
            <span>Ticket ID</span><span>Subject</span><span>Category</span>
            <span>Status</span><span>SLA</span><span>Submitted</span><span>Updated</span>
          </div>
          {filtered.map((t, i) => {
            const s   = statusColors[t.status]    ?? statusColors['Closed'];
            const cat = categoryColors[t.category] ?? categoryColors['General'];
            const sla = slaColors[mockSLA[i] ?? 'Within SLA'] ?? slaColors['Within SLA'];
            return (
              <div key={t.id}
                className="grid items-center px-5 py-4 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
                style={{ gridTemplateColumns: '100px 1fr 150px 130px 100px 100px 100px', columnGap: 8 }}>
                <span className="text-[12px] font-bold text-[#F56B22]">{t.ticketId}</span>
                <span className="text-[13px] font-semibold text-[#131C4E] truncate pr-4">{t.subject}</span>
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: cat.bg, color: cat.text }}>
                  {t.category}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: s.bg, color: s.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {t.status}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: sla.bg, color: sla.text }}>
                  {mockSLA[i]}
                </span>
                <span className="text-[11px] text-[#9CA3B8]">{new Date(t.submittedDate).toLocaleDateString('en-NG', { day:'2-digit', month:'short' })}</span>
                <span className="text-[11px] text-[#9CA3B8]">{new Date(t.lastUpdated).toLocaleDateString('en-NG', { day:'2-digit', month:'short' })}</span>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F8FA] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#9CA3B8]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#131C4E]">No tickets found</p>
                <p className="text-[12px] text-[#9CA3B8] mt-0.5">Try adjusting your search term</p>
              </div>
            </div>
          )}
        </div>

        {/* CREATE FORM */}
        {showForm && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#F0F1F5]">
                <p className="text-[15px] font-bold text-[#131C4E]">New Request</p>
                <button onClick={() => setShowForm(false)} className="text-[#9CA3B8] hover:text-[#131C4E] text-xl leading-none">✕</button>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest block mb-1.5">Category</label>
                  <select className="w-full h-10 px-3 text-[13px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none focus:border-[#F56B22]">
                    <option value="">Select category...</option>
                    {Object.keys(categoryColors).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest block mb-1.5">Subject</label>
                  <input className="w-full h-10 px-3 text-[13px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none focus:border-[#F56B22] placeholder:text-[#9CA3B8]" placeholder="Brief description..." />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest block mb-1.5">Details</label>
                  <textarea className="w-full h-24 px-3 py-2 text-[13px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none focus:border-[#F56B22] resize-none placeholder:text-[#9CA3B8]" placeholder="Describe your request..." />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9CA3B8] uppercase tracking-widest block mb-1.5">Attachments</label>
                  <div className="border-2 border-dashed border-[#E5E7F1] rounded-xl p-5 text-center bg-[#FAFBFC] cursor-pointer hover:border-[#F56B22] transition-colors">
                    <Paperclip className="w-5 h-5 text-[#9CA3B8] mx-auto mb-2" />
                    <p className="text-[12px] text-[#9CA3B8]">Drop files here or <span className="text-[#F56B22] font-semibold">browse</span></p>
                    <p className="text-[10px] text-[#C4C9D9] mt-1">Excel · PDF · PNG · JPG</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 border-t border-[#F0F1F5]">
                <button onClick={() => setShowForm(false)} className="flex-1 h-10 text-[13px] font-medium text-[#6B7280] border border-[#E5E7F1] rounded-xl hover:bg-[#F7F8FA]">Cancel</button>
                <button onClick={handleSubmit} className="flex-1 h-10 text-[13px] font-semibold text-white rounded-xl" style={{ background: '#F56B22' }}>Submit Request</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
