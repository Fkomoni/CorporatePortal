'use client';

import { useState } from 'react';
import { Plus, Paperclip } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { mockTickets } from '@/lib/mock-data';

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
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  'Enrolment':    { bg: '#EFF6FF', text: '#2563EB' },
  'Claims':       { bg: '#FFF7ED', text: '#C2410C' },
  'Benefits':     { bg: '#EEF2FF', text: '#3730A3' },
  'General':      { bg: '#F1F5F9', text: '#475569' },
  'Billing':      { bg: '#F0FDFD', text: '#0E7490' },
  'Provider':     { bg: '#FFF1F2', text: '#BE123C' },
};

const mockSLA = ['Within SLA', 'Within SLA', 'Near SLA', 'Within SLA', 'Breached', 'Within SLA', 'Near SLA', 'Within SLA'];

const summaryItems = [
  { label: 'Open',             value: 4,  color: '#EF4444' },
  { label: 'In Progress',      value: 6,  color: '#F59E0B' },
  { label: 'Awaiting Leadway', value: 2,  color: '#8B5CF6' },
  { label: 'Awaiting Client',  value: 1,  color: '#3B82F6' },
  { label: 'Closed',           value: 28, color: '#94A3B8' },
];

export default function ServiceDeskPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar title="Service Desk" subtitle="Ticket Management · SLA Tracking" />
      <div className="p-6 flex flex-col gap-5">

        <div className="flex items-center gap-4">
          {summaryItems.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl px-5 py-3 shadow-sm border border-[#F0F1F5] text-center min-w-[90px]">
              <p className="text-[24px] font-black leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-semibold text-[#9CA3B8] mt-1">{s.label}</p>
            </div>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 h-10 px-5 text-[13px] font-semibold text-white rounded-xl" style={{ background: '#F56B22' }}>
            <Plus className="w-4 h-4" /> New Request
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#F0F1F5] overflow-hidden">
          <div className="grid text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest px-5 py-3 bg-[#FAFBFC] border-b border-[#F0F1F5]"
            style={{ gridTemplateColumns: '100px 1fr 150px 130px 100px 100px 100px' }}>
            {['Ticket ID', 'Subject', 'Category', 'Status', 'SLA', 'Submitted', 'Updated'].map((h) => <span key={h}>{h}</span>)}
          </div>
          {mockTickets.map((t, i) => {
            const s   = statusColors[t.status] ?? statusColors['Closed'];
            const cat = categoryColors[t.category] ?? { bg: '#F1F5F9', text: '#475569' };
            const sla = slaColors[mockSLA[i] ?? 'Within SLA'];
            return (
              <div key={t.id} className="grid items-center px-5 py-3.5 border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] cursor-pointer"
                style={{ gridTemplateColumns: '100px 1fr 150px 130px 100px 100px 100px' }}>
                <span className="text-[12px] font-bold text-[#F56B22]">{t.ticketId}</span>
                <span className="text-[13px] font-semibold text-[#131C4E] truncate pr-4">{t.subject}</span>
                <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: cat.bg, color: cat.text }}>{t.category}</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: s.bg, color: s.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />{t.status}
                </span>
                <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-semibold w-fit" style={{ background: sla.bg, color: sla.text }}>{mockSLA[i]}</span>
                <span className="text-[11px] text-[#9CA3B8]">{new Date(t.submittedDate).toLocaleDateString('en-NG', { day:'2-digit', month:'short' })}</span>
                <span className="text-[11px] text-[#9CA3B8]">{new Date(t.lastUpdated).toLocaleDateString('en-NG', { day:'2-digit', month:'short' })}</span>
              </div>
            );
          })}
        </div>

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
                <button className="flex-1 h-10 text-[13px] font-semibold text-white rounded-xl" style={{ background: '#F56B22' }}>Submit Request</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
