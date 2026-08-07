'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Plus, Paperclip, Search, MessageSquare, X, Send,
  CircleDot, Loader, Building2, UserRound, CheckCircle2,
} from 'lucide-react';
import { ServiceDeskVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import {
  REQUEST_ROUTES, FALLBACK_CATEGORY, routeFor,
  MAX_ATTACHMENTS, MAX_ATTACHMENTS_TOTAL_BYTES, MAX_ATTACHMENT_BYTES,
  ATTACHMENT_ACCEPT, attachmentError, formatBytes,
} from '@/lib/service-request-routes';
import { TopBar } from '@/components/layout/TopBar';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';

// Row shape returned by /api/hr/service-requests.
interface ServiceRequestRow {
  id: string; ticketId: string; category: string; subject: string;
  description: string; status: string; submittedDate: string; lastUpdated: string;
  attachments?: string[];
}

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Open':            { bg: '#FEF2F2', text: '#DC2626',  dot: '#EF4444' },
  'In Progress':     { bg: '#FFFBEB', text: '#D97706',  dot: '#F59E0B' },
  'Awaiting Client': { bg: '#EFF6FF', text: '#2563EB',  dot: '#3B82F6' },
  'Awaiting Leadway':{ bg: '#F5F3FF', text: '#7C3AED',  dot: '#8B5CF6' },
  'Closed':          { bg: '#F1F5F9', text: '#475569',  dot: '#94A3B8' },
};

// Chip colours come from the routing table, so a queue's colour, its label and
// the mailbox it reaches are defined in one place. Requests raised before the
// five queues existed carry categories like "Claims" or "Provider" and fall
// back to neutral grey rather than disappearing.
const NEUTRAL_CHIP = { tint: '#F1F5F9', text: '#475569' };
function chipFor(category: string) {
  return routeFor(category) ?? NEUTRAL_CHIP;
}

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
  // ?new=1 opens the request form straight away: the dashboard's "Raise
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
  // Shown in the routing notice so HR sees the exact subject line before
  // submitting: the server builds the real one from the same session field.
  const companyName = useSession().data?.user?.companyName ?? '';

  // Real requests from Postgres: null while the first load is in flight.
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
  const selectedRoute = routeFor(formCategory);

  // Attachments. Held as base64 from the moment they are picked, so submit is a
  // plain JSON POST and there is no second failure mode at send time.
  interface PickedFile { fileName: string; size: number; base64Data: string }
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      // readAsDataURL gives "data:<mime>;base64,<data>". Prognosis wants the
      // payload only, and takes the content type as a separate field.
      reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(picked: FileList | null) {
    if (!picked?.length) return;
    setFileError('');
    const incoming = Array.from(picked);
    const problems: string[] = [];
    const accepted: PickedFile[] = [];
    let running = totalBytes;

    for (const file of incoming) {
      if (files.length + accepted.length >= MAX_ATTACHMENTS) {
        problems.push(`Only ${MAX_ATTACHMENTS} files can be attached: ${file.name} was not added.`);
        continue;
      }
      if (files.some((f) => f.fileName === file.name)) {
        problems.push(`${file.name} is already attached.`);
        continue;
      }
      const err = attachmentError({ name: file.name, size: file.size });
      if (err) { problems.push(err); continue; }
      if (running + file.size > MAX_ATTACHMENTS_TOTAL_BYTES) {
        problems.push(`${file.name} would take the total past ${formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)}.`);
        continue;
      }
      try {
        accepted.push({ fileName: file.name, size: file.size, base64Data: await readAsBase64(file) });
        running += file.size;
      } catch {
        problems.push(`Could not read ${file.name}.`);
      }
    }

    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    if (problems.length) setFileError(problems.join(' '));
    // Clearing the input means picking the same file twice in a row still fires
    // onChange.
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit() {
    if (submitting) return;
    // The category picks the mailbox, so it is no longer optional: silently
    // defaulting to General sent enrolment and billing requests to the wrong
    // desk.
    if (!formCategory) { toast('Please choose a category so your request reaches the right team.', 'error'); return; }
    if (!formSubject.trim()) { toast('Please enter a subject for your request.', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formCategory || FALLBACK_CATEGORY,
          subject: formSubject,
          description: formDetails,
          attachments: files.map((f) => ({ fileName: f.fileName, base64Data: f.base64Data })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast(json.error ?? 'Failed to submit request.', 'error'); return; }
      const ref = json.request?.ticketId ?? '';
      setShowForm(false);
      setFormCategory(''); setFormSubject(''); setFormDetails('');
      setFiles([]); setFileError('');
      // The request is saved either way; only claim the team has it when the
      // email actually went out.
      if (json.notified === false) {
        toast(`Request ${ref} saved, but the notification email could not be sent. Please call your account manager.`, 'error');
      } else {
        toast(`Request ${ref} sent to our ${formCategory} desk: you are copied on the email.`);
      }
      loadRequests();
    } catch {
      toast('Network error. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Service Desk" subtitle="Ticket Management · SLA Tracking" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* SUMMARY CARDS */}
        {vis.showSummaryCards && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 16 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: `110px minmax(0,1fr) 164px 160px${vis.showSlaColumn ? ' 110px' : ''} 100px 100px`, columnGap: 12, padding: '12px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            {['Ticket ID', 'Subject', 'Category', 'Status', ...(vis.showSlaColumn ? ['SLA'] : []), 'Submitted', 'Updated'].map((h) => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
            ))}
          </div>

          {filtered.map((t) => {
            const s   = statusColors[t.status] ?? statusColors['Closed'];
            const cat = chipFor(t.category);
            return (
              <div key={t.id}
                style={{ display: 'grid', gridTemplateColumns: `110px minmax(0,1fr) 164px 160px${vis.showSlaColumn ? ' 110px' : ''} 100px 100px`, columnGap: 12, alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F7F8FA', cursor: 'pointer', transition: 'background 0.12s' }}
                className="hover:bg-[#FAFBFC] last:border-0">
                <span style={{ fontSize: 12, fontWeight: 700, color: '#F56B22', fontFamily: 'monospace' }}>{t.ticketId}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, paddingRight: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                  {/* Filenames are kept on the request; the files themselves went
                      out on the email. This is how HR remembers what they sent. */}
                  {!!t.attachments?.length && (
                    <span title={t.attachments.join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0, color: '#9CA3B8' }}>
                      <Paperclip style={{ width: 11, height: 11 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.attachments.length}</span>
                    </span>
                  )}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: cat.tint, color: cat.text, width: 'fit-content', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {t.category}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: s.bg, color: s.text, width: 'fit-content' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  {t.status}
                </span>
                {/* SLA tracking needs staff-side workflows that don't exist
                    yet, so the column stays honest with a placeholder. */}
                {vis.showSlaColumn && <span style={{ fontSize: 11, color: '#C4C9D9' }}>-</span>}
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
                  {requests === null ? 'Loading requests...' : loadError ? 'Could not load requests' : tickets.length === 0 ? 'No requests yet' : 'No matching requests'}
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
                  <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} style={{ width: '100%', height: 42, padding: '0 12px', fontSize: 13, border: `1px solid ${formCategory ? '#E5E7F1' : '#F6C9AC'}`, borderRadius: 14, background: '#FAFBFC', color: formCategory ? '#131C4E' : '#9CA3B8', outline: 'none' }}>
                    <option value="">Select the team that should handle this...</option>
                    {REQUEST_ROUTES.map((r) => <option key={r.category} value={r.category}>{r.category}</option>)}
                  </select>
                  {/* The category decides which Leadway mailbox receives the
                      request, so the hint is worth the vertical space: a
                      misrouted ticket costs a day. */}
                  <p style={{ fontSize: 11.5, color: selectedRoute ? '#6B7480' : '#C2410C', lineHeight: 1.5, marginTop: 7 }}>
                    {selectedRoute
                      ? selectedRoute.hint
                      : 'Pick a category so your request reaches the right desk first time.'}
                  </p>
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
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                    Attachments <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#C4C9D9' }}>· optional</span>
                  </label>

                  {files.length < MAX_ATTACHMENTS && (
                    <div
                      role="button" tabIndex={0}
                      onClick={() => fileRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
                      style={{ border: `2px dashed ${dragOver ? '#F56B22' : '#E5E7F1'}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', background: dragOver ? '#FFF8F5' : '#FAFBFC', cursor: 'pointer', transition: 'all 0.15s', outline: 'none' }}>
                      <Paperclip style={{ width: 20, height: 20, color: dragOver ? '#F56B22' : '#9CA3B8', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: 12, color: '#9CA3B8' }}>Drop files here or <span style={{ color: '#F56B22', fontWeight: 600 }}>browse</span></p>
                      <p style={{ fontSize: 10, color: '#C4C9D9', marginTop: 4 }}>
                        Excel · PDF · Word · PNG · JPG · up to {formatBytes(MAX_ATTACHMENT_BYTES)} each, {MAX_ATTACHMENTS} files
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileRef} type="file" multiple accept={ATTACHMENT_ACCEPT}
                    style={{ display: 'none' }}
                    onChange={(e) => void addFiles(e.target.files)}
                  />

                  {files.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: files.length < MAX_ATTACHMENTS ? 10 : 0 }}>
                      {files.map((f) => (
                        <div key={f.fileName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid #E5E7F1', background: '#FAFBFC' }}>
                          <Paperclip style={{ width: 13, height: 13, color: '#9CA3B8', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</p>
                            <p style={{ fontSize: 10.5, color: '#9CA3B8', marginTop: 1 }}>{formatBytes(f.size)}</p>
                          </div>
                          <button
                            onClick={() => { setFiles((prev) => prev.filter((p) => p.fileName !== f.fileName)); setFileError(''); }}
                            aria-label={`Remove ${f.fileName}`}
                            style={{ padding: 5, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3B8', display: 'flex', flexShrink: 0 }}>
                            <X style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      ))}
                      <p style={{ fontSize: 10.5, color: '#B0B7C9' }}>
                        {files.length} of {MAX_ATTACHMENTS} · {formatBytes(totalBytes)} of {formatBytes(MAX_ATTACHMENTS_TOTAL_BYTES)}
                      </p>
                    </div>
                  )}

                  {fileError && (
                    <p style={{ fontSize: 11.5, color: '#C2410C', marginTop: 8, lineHeight: 1.5 }}>{fileError}</p>
                  )}
                </div>
              </div>
              {/* Tells HR what happens on submit, which desk it reaches, and
                  that they stay in the thread. Without this the CC is
                  invisible and HR chases a request they think vanished. */}
              {selectedRoute && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '0 24px', padding: '12px 14px', background: '#FFF7ED', border: '1px solid #FBE0CB', borderRadius: 12 }}>
                  <Send style={{ width: 14, height: 14, color: '#F56B22', flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 11.5, color: '#8A4A1B', lineHeight: 1.55, minWidth: 0 }}>
                    Goes to the Leadway <strong>{selectedRoute.category}</strong> desk with the subject{' '}
                    <span style={{ fontWeight: 600 }}>“Corporate Portal - {selectedRoute.subjectTag} - {companyName || 'your company'}”</span>.
                    You will be copied, so replies come back to you.
                  </p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, padding: '16px 24px', borderTop: selectedRoute ? 'none' : '1px solid #F0F1F5' }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#6B7480', border: '1px solid #E5E7F1', borderRadius: 24, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: submitting ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary above it to prerender -
// same pattern as the People page.
export default function ServiceDeskPage() {
  return (
    <Suspense fallback={null}>
      <ServiceDeskInner />
    </Suspense>
  );
}
