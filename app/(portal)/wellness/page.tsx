'use client';

import { useState, useRef, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import {
  Heart, Video, MapPin, Users, Send, CheckCircle,
  Activity, Mail, Link2, Clock, TrendingUp, Stethoscope, Search, X,
} from 'lucide-react';
import { mockMembers } from '@/lib/mock-data';
import type { Member } from '@/lib/types';

// ── Mock data ─────────────────────────────────────────────────────────────────

const SCREENING_STATS = {
  totalEligible:  1247,
  hrReferral:      143,
  leadwaySystem:   289,
  totalScreened:   432,
  pending:         815,
  spouseScreened:   98,
};

const RECENT_SCREENINGS = [
  { name: 'Adewale Adeyemi',  empId: 'EMP-0042', type: 'HR Referral',    date: 'Jun 20, 2026', status: 'Completed' },
  { name: 'Chisom Okafor',    empId: 'EMP-0117', type: 'Leadway System', date: 'Jun 19, 2026', status: 'Completed' },
  { name: 'Fatima Al-Hassan', empId: 'EMP-0203', type: 'HR Referral',    date: 'Jun 18, 2026', status: 'Completed' },
  { name: 'Emeka Nwosu',      empId: 'EMP-0089', type: 'Leadway System', date: 'Jun 17, 2026', status: 'Completed' },
  { name: 'Ngozi Eze',        empId: 'EMP-0155', type: 'HR Referral',    date: 'Jun 15, 2026', status: 'Completed' },
];

const INITIAL_SENT_LINKS = [
  { id: 1, name: 'Bello Usman',     email: 'b.usman@dangote.com',     spouse: true,  sentDate: 'Jun 22, 2026', status: 'Booked'    },
  { id: 2, name: 'Amaka Obi',       email: 'a.obi@dangote.com',       spouse: false, sentDate: 'Jun 21, 2026', status: 'Pending'   },
  { id: 3, name: 'Tunde Fashola',   email: 't.fashola@dangote.com',   spouse: true,  sentDate: 'Jun 20, 2026', status: 'Completed' },
  { id: 4, name: 'Grace Ihejirika', email: 'g.ihejirika@dangote.com', spouse: false, sentDate: 'Jun 19, 2026', status: 'Pending'   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: on ? '#F56B22' : '#E5E7F1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s', display: 'block' }} />
    </button>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, marginTop: 16 }}>
      <CheckCircle style={{ width: 16, height: 16, color: '#059669', flexShrink: 0 }} />
      <p style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>{message}</p>
    </div>
  );
}

const statusColors: Record<string, { bg: string; text: string }> = {
  Pending:   { bg: '#FFFBEB', text: '#D97706' },
  Booked:    { bg: '#EFF6FF', text: '#2563EB' },
  Completed: { bg: '#ECFDF5', text: '#059669' },
};

type Tab = 'talks' | 'screening' | 'dashboard';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WellnessPage() {
  const [activeTab, setActiveTab] = useState<Tab>('talks');

  // Health talks form
  const [talkType, setTalkType]       = useState<'onsite' | 'virtual'>('onsite');
  const [talkTopic, setTalkTopic]     = useState('');
  const [talkDate, setTalkDate]       = useState('');
  const [talkDuration, setTalkDuration] = useState('60');
  const [talkAttendees, setTalkAttendees] = useState('');
  const [talkNotes, setTalkNotes]     = useState('');
  const [talkSent, setTalkSent]       = useState(false);

  // Onsite screening form
  const [scrParticipants, setScrParticipants] = useState('');
  const [scrDate, setScrDate]         = useState('');
  const [scrVenue, setScrVenue]       = useState('');
  const [scrNotes, setScrNotes]       = useState('');
  const [scrSent, setScrSent]         = useState(false);

  // Send screening link form — member search
  const [linkQuery, setLinkQuery]         = useState('');
  const [linkResults, setLinkResults]     = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [linkSpouse, setLinkSpouse]         = useState(false);
  const [linkSpouseEmail, setLinkSpouseEmail] = useState('');
  const [linkMessage, setLinkMessage]       = useState('');
  const [linkSent, setLinkSent]             = useState(false);
  const [sentLinks, setSentLinks]           = useState(INITIAL_SENT_LINKS);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setLinkResults([]);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function handleLinkSearch(q: string) {
    setLinkQuery(q);
    setSelectedMember(null);
    if (!q.trim()) { setLinkResults([]); return; }
    const lower = q.toLowerCase();
    const principals = mockMembers.filter((m) => m.type === 'Principal' && m.status === 'Active');
    setLinkResults(
      principals.filter((m) =>
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(lower) ||
        m.employeeId.toLowerCase().includes(lower)
      ).slice(0, 6)
    );
  }

  function selectMember(m: Member) {
    setSelectedMember(m);
    setLinkQuery(`${m.firstName} ${m.lastName}`);
    setLinkResults([]);
  }

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
  const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };
  const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; };
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; };

  const tabs: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: 'talks',     label: 'Health Talks',       Icon: Activity    },
    { key: 'screening', label: 'Health Screenings',  Icon: Stethoscope },
    { key: 'dashboard', label: 'Screening Dashboard', Icon: TrendingUp  },
  ];

  const pctScreened = Math.round((SCREENING_STATS.totalScreened / SCREENING_STATS.totalEligible) * 100);
  const pctHr       = Math.round((SCREENING_STATS.hrReferral    / SCREENING_STATS.totalEligible) * 100);
  const pctLeadway  = Math.round((SCREENING_STATS.leadwaySystem  / SCREENING_STATS.totalEligible) * 100);

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Wellness" subtitle="Health Talks · Screenings · Annual Medical" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === key ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : 'transparent',
                color: activeTab === key ? '#fff' : '#6B7280',
                boxShadow: activeTab === key ? '0 2px 8px rgba(245,107,34,0.28)' : 'none' }}>
              <Icon style={{ width: 14, height: 14 }} />
              {label}
            </button>
          ))}
        </div>

        {/* ── HEALTH TALKS ── */}
        {activeTab === 'talks' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
            <div style={{ ...card, padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity style={{ width: 18, height: 18, color: '#F56B22' }} />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E' }}>Request a Health Talk</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Your request goes directly to Leadway Health client services</p>
                </div>
              </div>

              {/* Talk type */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Talk Format</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {([
                    { key: 'onsite'  as const, Icon: MapPin, label: 'Onsite'  },
                    { key: 'virtual' as const, Icon: Video,  label: 'Virtual' },
                  ]).map(({ key, Icon, label }) => (
                    <button key={key} onClick={() => setTalkType(key)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 12, border: `1.5px solid ${talkType === key ? '#F56B22' : '#E5E7F1'}`, background: talkType === key ? '#FFF5EF' : '#fff', color: talkType === key ? '#F56B22' : '#6B7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                      <Icon style={{ width: 15, height: 15 }} /> {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Talk Topic / Title</label>
                  <input value={talkTopic} onChange={(e) => setTalkTopic(e.target.value)} placeholder="e.g. Stress Management & Mental Wellness" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
                <div>
                  <label style={labelStyle}>Preferred Date</label>
                  <input type="date" value={talkDate} onChange={(e) => setTalkDate(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
                <div>
                  <label style={labelStyle}>Duration (minutes)</label>
                  <select value={talkDuration} onChange={(e) => setTalkDuration(e.target.value)} style={{ ...inputStyle, appearance: 'none' }} onFocus={focusIn} onBlur={focusOut}>
                    {['30','45','60','90','120'].map((d) => <option key={d} value={d}>{d} mins</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Expected Attendees</label>
                  <input type="number" value={talkAttendees} onChange={(e) => setTalkAttendees(e.target.value)} placeholder="e.g. 80" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
                <div>
                  <label style={labelStyle}>Venue {talkType === 'virtual' ? '/ Platform' : ''}</label>
                  <input value={talkNotes} onChange={(e) => setTalkNotes(e.target.value)} placeholder={talkType === 'virtual' ? 'e.g. Microsoft Teams' : 'e.g. Main Conference Hall, HQ'} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                </div>
              </div>

              <button
                onClick={() => { if (talkTopic && talkDate && talkAttendees) { setTalkSent(true); setTalkTopic(''); setTalkDate(''); setTalkAttendees(''); setTalkNotes(''); } }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 10px rgba(245,107,34,0.32)' }}>
                <Send style={{ width: 14, height: 14 }} /> Send Request to Client Services
              </button>

              {talkSent && <SuccessBanner message="Request sent! Leadway Health client services will reach out within 1 business day to confirm." />}
            </div>

            {/* Info panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, padding: '22px 24px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 14 }}>Available Talk Topics</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    'Stress & Mental Wellness',
                    'Hypertension & Heart Health',
                    'Diabetes Awareness',
                    'Nutrition & Healthy Eating',
                    "Women's Health & Fertility",
                    'Cancer Screening Awareness',
                    'Physical Activity & Exercise',
                    'Eye & Dental Health',
                  ].map((t) => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F56B22', flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: '#374151' }}>{t}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderRadius: 16, padding: '20px 22px', background: 'linear-gradient(135deg,#131C4E,#3A4382)', color: '#fff' }}>
                <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Need a custom topic?</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>Describe your preferred health topic in the notes field and the client services team will advise on availability.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── HEALTH SCREENINGS ── */}
        {activeTab === 'screening' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* LEFT: Onsite Screening Exercise */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ ...card, padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users style={{ width: 18, height: 18, color: '#2563EB' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Request Onsite Screening</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Group screening exercise for your workforce</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Expected Participants</label>
                    <input type="number" value={scrParticipants} onChange={(e) => setScrParticipants(e.target.value)} placeholder="e.g. 250" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </div>
                  <div>
                    <label style={labelStyle}>Preferred Date</label>
                    <input type="date" value={scrDate} onChange={(e) => setScrDate(e.target.value)} style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </div>
                  <div>
                    <label style={labelStyle}>Venue / Location</label>
                    <input value={scrVenue} onChange={(e) => setScrVenue(e.target.value)} placeholder="e.g. Staff Clinic, Apapa Plant" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                  </div>
                  <div>
                    <label style={labelStyle}>Additional Notes</label>
                    <textarea value={scrNotes} onChange={(e) => setScrNotes(e.target.value)} rows={3} placeholder="Any specific tests or requirements..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical', fontFamily: 'inherit' }} onFocus={focusIn} onBlur={focusOut} />
                  </div>
                </div>
                <button
                  onClick={() => { if (scrParticipants && scrDate && scrVenue) { setScrSent(true); setScrParticipants(''); setScrDate(''); setScrVenue(''); setScrNotes(''); } }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', background: 'linear-gradient(135deg,#2563EB,#3B82F6)', boxShadow: '0 2px 10px rgba(37,99,235,0.28)' }}>
                  <Send style={{ width: 14, height: 14 }} /> Submit to Client Services
                </button>
                {scrSent && <SuccessBanner message="Screening request submitted! Client services will confirm logistics within 2 business days." />}
              </div>
            </div>

            {/* RIGHT: Send Annual Screening Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ ...card, padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Link2 style={{ width: 18, height: 18, color: '#059669' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Send Screening Booking Link</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Invite a member (and spouse) to book their annual medical</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>

                  {/* Member search */}
                  <div ref={searchRef} style={{ position: 'relative' }}>
                    <label style={labelStyle}>Search Member by Name or ID</label>
                    <div style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#9CA3B8', pointerEvents: 'none' }} />
                      <input
                        value={linkQuery}
                        onChange={(e) => handleLinkSearch(e.target.value)}
                        placeholder="Type name or employee ID…"
                        style={{ ...inputStyle, paddingLeft: 38, paddingRight: selectedMember ? 36 : 14 }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; if (linkQuery && !selectedMember) handleLinkSearch(linkQuery); }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = selectedMember ? '#A7F3D0' : '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
                      />
                      {selectedMember && (
                        <button onClick={() => { setSelectedMember(null); setLinkQuery(''); setLinkSpouse(false); setLinkSpouseEmail(''); }}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3B8', padding: 0, lineHeight: 0 }}>
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      )}
                    </div>

                    {/* Dropdown results */}
                    {linkResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #E5E7F1', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden', marginTop: 4 }}>
                        {linkResults.map((m) => (
                          <button key={m.id} onMouseDown={() => selectMember(m)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF5EF'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#131C4E,#3A4382)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                              {m.firstName[0]}{m.lastName[0]}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{m.firstName} {m.lastName}</p>
                              <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{m.employeeId} · {m.plan} · {m.location}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Confirmed member card */}
                  {selectedMember && (
                    <div style={{ padding: '14px 16px', background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#131C4E,#3A4382)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>{selectedMember.firstName} {selectedMember.lastName}</p>
                        <p style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>{selectedMember.employeeId} · {selectedMember.email}</p>
                        <p style={{ fontSize: 11, color: '#059669', marginTop: 1 }}>{selectedMember.plan} · {selectedMember.location}</p>
                      </div>
                      <CheckCircle style={{ width: 18, height: 18, color: '#059669', flexShrink: 0 }} />
                    </div>
                  )}

                  {selectedMember && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FAFBFC', borderRadius: 12, border: '1px solid #E5E7F1' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>Include Spouse</p>
                          <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>Send a separate booking link to the member&apos;s spouse</p>
                        </div>
                        <Toggle on={linkSpouse} onChange={() => setLinkSpouse(!linkSpouse)} />
                      </div>
                      {linkSpouse && (
                        <div>
                          <label style={labelStyle}>Spouse Email</label>
                          <input type="email" value={linkSpouseEmail} onChange={(e) => setLinkSpouseEmail(e.target.value)} placeholder="spouse@email.com" style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
                        </div>
                      )}
                      <div>
                        <label style={labelStyle}>Personal Message (optional)</label>
                        <textarea value={linkMessage} onChange={(e) => setLinkMessage(e.target.value)} rows={2} placeholder="Add a short note to accompany the link…" style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'none', fontFamily: 'inherit' }} onFocus={focusIn} onBlur={focusOut} />
                      </div>
                    </>
                  )}
                </div>
                <button
                  disabled={!selectedMember}
                  onClick={() => {
                    if (!selectedMember) return;
                    setSentLinks([{ id: Date.now(), name: `${selectedMember.firstName} ${selectedMember.lastName}`, email: selectedMember.email, spouse: linkSpouse, sentDate: 'Jun 25, 2026', status: 'Pending' }, ...sentLinks]);
                    setSelectedMember(null); setLinkQuery(''); setLinkSpouse(false); setLinkSpouseEmail(''); setLinkMessage('');
                    setLinkSent(true); setTimeout(() => setLinkSent(false), 4000);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: selectedMember ? 'pointer' : 'not-allowed', opacity: selectedMember ? 1 : 0.45, background: 'linear-gradient(135deg,#059669,#10B981)', boxShadow: selectedMember ? '0 2px 10px rgba(5,150,105,0.28)' : 'none', transition: 'all 0.2s' }}>
                  <Mail style={{ width: 14, height: 14 }} /> Send Booking Link
                </button>
                {linkSent && <SuccessBanner message="Booking link sent! The member will receive an email with instructions to schedule their screening." />}
              </div>

              {/* Sent links log */}
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>Recently Sent Links</p>
                </div>
                {sentLinks.slice(0, 6).map((l, i) => {
                  const sc = statusColors[l.status] ?? statusColors['Pending'];
                  return (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < Math.min(sentLinks.length, 6) - 1 ? '1px solid #F7F8FA' : 'none' }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#131C4E' }}>{l.name}</p>
                        <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 1 }}>{l.email}{l.spouse ? ' + spouse' : ''} · {l.sentDate}</p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: sc.bg, color: sc.text, whiteSpace: 'nowrap' }}>{l.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SCREENING DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { label: 'Total Eligible Members', value: SCREENING_STATS.totalEligible, sub: 'Principal members on active plans', color: '#131C4E', pct: undefined },
                { label: 'Screened — HR Referral',  value: SCREENING_STATS.hrReferral,    sub: 'Via links sent by your team',        color: '#F56B22', pct: pctHr       },
                { label: 'Screened — Leadway System', value: SCREENING_STATS.leadwaySystem, sub: 'Booked directly through Leadway',   color: '#2563EB', pct: pctLeadway  },
              ].map(({ label, value, sub, color, pct }) => (
                <div key={label} style={{ ...card, padding: '22px 24px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{label}</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 36, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1 }}>{value.toLocaleString()}</p>
                    {pct !== undefined && <p style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 4 }}>{pct}%</p>}
                  </div>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: pct !== undefined ? 10 : 0 }}>{sub}</p>
                  {pct !== undefined && (
                    <div style={{ height: 6, borderRadius: 99, background: '#F0F1F5', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 0.6s ease' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total screened + pending */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ ...card, padding: '22px 24px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Total Screened (All Sources)</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 36, fontWeight: 800, color: '#059669', letterSpacing: '-0.03em', lineHeight: 1 }}>{SCREENING_STATS.totalScreened.toLocaleString()}</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>of {SCREENING_STATS.totalEligible.toLocaleString()} eligible · {pctScreened}% coverage</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 10, borderRadius: 99, background: '#F0F1F5', overflow: 'hidden' }}>
                      <div style={{ width: `${pctScreened}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#F56B22,#059669)', transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#059669' }}>Screened {pctScreened}%</p>
                      <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3B8' }}>Pending {100 - pctScreened}%</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ ...card, padding: '22px 24px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Spouse Screenings Completed</p>
                <p style={{ fontSize: 36, fontWeight: 800, color: '#7C3AED', letterSpacing: '-0.03em', lineHeight: 1 }}>{SCREENING_STATS.spouseScreened}</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4 }}>Spousal coverage across active plans</p>
                <div style={{ marginTop: 10, height: 6, borderRadius: 99, background: '#F0F1F5', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((SCREENING_STATS.spouseScreened / SCREENING_STATS.totalEligible) * 100)}%`, height: '100%', borderRadius: 99, background: '#7C3AED', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            </div>

            {/* Recent screenings table */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Recent Screenings</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Latest completed annual medical screenings</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 99, padding: '4px 12px' }}>
                  Live data
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 140px 100px', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                {['Member', 'Emp ID', 'Source', 'Date', 'Status'].map((h) => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>
              {RECENT_SCREENINGS.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 160px 140px 100px', columnGap: 12, alignItems: 'center', padding: '14px 24px', borderBottom: i < RECENT_SCREENINGS.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{s.name}</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8' }}>{s.empId}</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
                    color: s.type === 'HR Referral' ? '#F56B22' : '#2563EB',
                    background: s.type === 'HR Referral' ? '#FFF5EF' : '#EFF6FF',
                    padding: '3px 10px', borderRadius: 8, width: 'fit-content' }}>
                    {s.type === 'HR Referral' ? <Link2 style={{ width: 10, height: 10 }} /> : <Activity style={{ width: 10, height: 10 }} />}
                    {s.type}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock style={{ width: 12, height: 12, color: '#9CA3B8' }} />
                    <span style={{ fontSize: 12, color: '#9CA3B8' }}>{s.date}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#ECFDF5', color: '#059669', width: 'fit-content' }}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
