'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Paperclip, Search, MessageSquare, X,
  CircleDot, Loader, Building2, UserRound, CheckCircle2,
} from 'lucide-react';
import { ServiceDeskVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import { TopBar } from '@/components/layout/TopBar';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';

// Row shape returned by /api/hr/service-requests.
interface ServiceRequestRow {
  id: string; ticketId: string; category: string; subject: string;
  description: string; status: string; submittedDate: string; lastUpdated: string;
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Open':            { bg: '#FEF2F2', text: '#DC2626',  dot: '#EF4444' },
  'In Progress':     { bg: '#FFFBEB', text: '#D97706',  dot: '#F59E0B' },
  'Awaiting Client': { bg: '#EFF6FF', text: '#2563EB',  dot: '#3B82F6' },
  'Awaiting Leadway':{ bg: '#F5F3FF', text: '#7C3AED',  dot: '#8B5CF6' },
  'Closed':          { bg: '#F1F5F9', text: '#475569',  dot: '#94A3B8' },
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  'Enrolment': { bg: '#EFF6FF', text: '#2563EB' },
  'Claims':    { bg: '#FFF7ED', text: '#C2410C' },
  'Benefits':  { bg: '#EEF2FF', text: '#3730A3' },
  'General':   { bg: '#F1F5F9', text: '#475569' },
  'Billing':   { bg: '#FFFBEB', text: '#D97706' },
  'Provider':  { bg: '#FFF1F2', text: '#BE123C' },
};

// Counted off the ticket list rather than hardcoded. The previous fixed
// numbers (4 / 6 / 2 / 1 / 28) disagreed with the table right below them, so
// the strip and the rows told two different stories.
const SUMMARY_STATUSES: { label: string; color: string; tint: string; icon: React.ElementType }[] = [
  { label: 'Open',             color: '#EF4444', tint: '#FEF2F2', icon: CircleDot },
  { label: 'In Progress',      color: '#D97706', tint: '#FFFBEB', icon: Loader },
  { label: 'Awaiting Leadway', color: '#7C3AED', tint: '#F5F3FF', icon: Building2 },
  { label: 'Awaiting Client',  color: '#2563EB', tint: '#EFF6FF', icon: UserRound },
  { label: 'Closed',           color: '#64748B', tint: '#F1F5F9', icon: CheckCircle2 },
];

function ServiceDeskInner() {
  // ?new=1 opens the request form straight away — the dashboard's "Raise
  // request" quick action lands here.
  const openFormOnLoad = useSearchParams().get('new') === '1';
  const [showForm, setShowForm] = useState(openFormOnLoad);
  const [search, setSearch] = useState('');
  // Clicking a summary card narrows the table to that status, so the strip is
  // a control rather than decoration.
  const [statusFilter, setStatusFilter] = useState('');
  const [vis, setVis] = useState<ServiceDeskVis>(DEFAULTS.serviceDesk);
  useEffect(() => { setVis(getVis('serviceDesk')); }, []);
  const { toast } = useToast();

  // Real requests from Postgres — null while the first load is in flight.
  const [requests, setRequests] = useState<ServiceRequestRow[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const loadRequests = useCallback(() => {
    setLoadError('');
    fetch('/api/hr/service-requests')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setLoadError(String(d.error)); setRequests([]); return; }
        setRequests(Array.isArray(d.requests) ? d.requests : []);
      })
      .catch(() => { setLoadError('Could not load requests.'); setRequests([]); });
  }, []);
  // Loading on mount unavoidably sets state from an effect; the rule is about
  // avoiding cascading renders, which a single fetch-on-mount does not cause.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const tickets = requests ?? [];
  const filtered = tickets.filter((t) => {
    const q = search.toLowerCase();
    const matchesQuery = !q || t.ticketId.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    return matchesQuery && (!statusFilter || t.status === statusFilter);
  });

  // New Request form
  const [formCategory, setFormCategory] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    if (!formSubject.trim()) { toast('Please enter a subject for your request.', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: formCategory || 'General', subject: formSubject, description: formDetails }),
      });
      const json = await res.json();
      if (!res.ok) { toast(json.error ?? 'Failed to submit request.', 'error'); return; }
      setShowForm(false);
      setFormCategory(''); setFormSubject(''); setFormDetails('');
      toast(`Request ${json.request?.ticketId ?? ''} submitted — our team will respond within 24 hours.`);
      loadRequests();
    } catch {
      toast('Network error — please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Service Desk" subtitle="Ticket Management · SLA Tracking" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* SUMMARY CARDS */}
        {vis.showSummaryCards && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          {SUMMARY_STATUSES.map((s) => {
            const count = tickets.filter((t) => t.status === s.label).length;
            return (
              <StatCard
                key={s.label}
                label={s.label}
                sub={`${count} of ${tickets.length} request${tickets.length === 1 ? '' : 's'}`}
                value={count.toLocaleString()}
                icon={s.icon}
                color={s.color}
                tint={s.tint}
                loading={requests === null}
                onClick={() => setStatusFilter((cur) => (cur === s.label ? '' : s.label))}
              />
            );
          })}
        </div>}

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
          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#131C4E', background: '#FAFBFC', border: '1px solid #E5E7F1', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {statusFilter}
              <X style={{ width: 13, height: 13, color: '#9CA3B8' }} />
            </button>
          )}
          <div style={{ flex: 1 }} />
          {vis.showNewRequest && <button
            onClick={() => setShowForm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', whiteSpace: 'nowrap' }}>
            <Plus style={{ width: 16, height: 16 }} /> New Request
          </button>}
        </div>

        {/* TICKET TABLE */}
        {vis.showTicketTable && <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `110px 1fr 140px 160px${vis.showSlaColumn ? ' 110px' : ''} 100px 100px`, columnGap: 12, padding: '12px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            {['Ticket ID', 'Subject', 'Category', 'Status', ...(vis.showSlaColumn ? ['SLA'] : []), 'Submitted', 'Updated'].map((h) => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {filtered.map((t) => {
            const s   = statusColors[t.status]     ?? statusColors['Closed'];
            const cat = categoryColors[t.category]  ?? categoryColors['General'];
            return (
              <div key={t.id}
                style={{ display: 'grid', gridTemplateColumns: `110px 1fr 140px 160px${vis.showSlaColumn ? ' 110px' : ''} 100px 100px`, columnGap: 12, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F7F8FA', cursor: 'pointer', transition: 'background 0.12s' }}
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
                {/* SLA tracking needs staff-side workflows that don't exist
                    yet, so the column stays honest with a placeholder. */}
                {vis.showSlaColumn && <span style={{ fontSize: 11, color: '#C4C9D9' }}>—</span>}
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
                <p style={{ fontSize: 14, fontWeight: 600, color: '#131C4E' }}>
                  {requests === null ? 'Loading requests…' : loadError ? 'Could not load requests' : tickets.length === 0 ? 'No requests yet' : 'No matching requests'}
                </p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>
                  {requests === null ? 'One moment.' : loadError ? loadError : tickets.length === 0 ? 'Raise your first request with the New Request button.' : 'Try adjusting your search term'}
                </p>
              </div>
            </div>
          )}
        </div>}

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
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} style={{ width: '100%', height: 42, padding: '0 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none' }}>
                    <option value="">Select category...</option>
                    {Object.keys(categoryColors).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Subject</label>
                  <input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} maxLength={200} style={{ width: '100%', height: 42, padding: '0 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }} placeholder="Brief description..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Details</label>
                  <textarea value={formDetails} onChange={(e) => setFormDetails(e.target.value)} maxLength={5000} style={{ width: '100%', height: 96, padding: '10px 12px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', resize: 'none', boxSizing: 'border-box' }} placeholder="Describe your request..." />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Attachments</label>
                  <div style={{ border: '2px dashed #E5E7F1', borderRadius: 14, padding: '20px 16px', textAlign: 'center', background: '#FAFBFC', cursor: 'pointer' }}>
                    <Paperclip style={{ width: 20, height: 20, color: '#9CA3B8', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: '#9CA3B8' }}>Drop files here or <span style={{ color: '#F56B22', fontWeight: 600 }}>browse</span></p>
                    <p style={{ fontSize: 10, color: '#C4C9D9', marginTop: 4 }}>Excel · PDF · PNG · JPG</p>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: '1px solid #F0F1F5' }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#6B7480', border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: submitting ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Submitting…' : 'Submit Request'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary above it to prerender —
// same pattern as the People page.
export default function ServiceDeskPage() {
  return (
    <Suspense fallback={null}>
      <ServiceDeskInner />
    </Suspense>
  );
}
