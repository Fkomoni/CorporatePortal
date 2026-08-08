'use client';

import { useState, useRef, useEffect } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import {
  Video, MapPin, Users, Send, CheckCircle,
  Activity, Mail, Link2, Clock, TrendingUp, Stethoscope, Search, X, Info,
} from 'lucide-react';
import { isCoveredStatus, type Member } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

//  Health Talk Topics

const HEALTH_TALK_CATEGORIES: { category: string; color: string; topics: string[] }[] = [
  {
    category: 'Human Behaviour',
    color: '#F56B22',
    topics: [
      'Alcohol and Substance Abuse',
      'Accident Preparedness and First Aid',
      'Benefits of Physical Exercise',
      'Benefits of Yoga, Meditation and Mindfulness',
      'Blood Donation and Voluntary Service',
      'Causes and Prevention of Road Traffic Accidents',
      'Challenges of Sedentary Lifestyle',
      'Dangers of Drug Abuse',
      'Dangers of Smoking',
      'Employee Wellness and Productivity',
      'Ergonomics in the Workplace',
      'Food Poisoning and Hygiene',
      'Healthy Ageing',
      'How to Identify Quality Health Care',
      'Nutrition and Balanced Diet',
      'Occupational Health and Safety',
      'Personal Hygiene and Health',
      'Prevention of Workplace Injuries',
      'Stress Management in the Workplace',
      'The Importance of Regular Medical Checkups',
      'Understanding Health Insurance',
    ],
  },
  {
    category: 'Health and Wellbeing',
    color: '#059669',
    topics: [
      'Antenatal and Postnatal Care',
      'Benefits of Breastfeeding',
      'Bone Health and Osteoporosis Prevention',
      'Child Health and Immunisation',
      'Contraception and Family Planning',
      'Dental Health and Oral Hygiene',
      'Eye Health and Vision Care',
      'Fibroids: Causes, Symptoms and Treatment',
      'Healthy Eating During Pregnancy',
      'Healthy Weight Management',
      'Importance of Vaccination for Adults',
      'Management of Chronic Pain',
      'Managing Allergies and Asthma',
      'Menopause: Symptoms and Management',
      "Men's Health Awareness",
      'Nutrition for the Elderly',
      'Preventing Back Pain',
      'Sexual and Reproductive Health',
      'Skin Care and Dermatology',
      'Understanding Anaemia',
      "Women's Health Awareness",
    ],
  },
  {
    category: 'Fatigue',
    color: '#D97706',
    topics: [
      'Causes and Effects of Workplace Fatigue',
      'Compassion Fatigue in Caregivers',
      'Fatigue and Occupational Safety',
      'Managing Chronic Fatigue Syndrome',
      'Mental Fatigue and Cognitive Performance',
      'Nutrition Strategies to Combat Fatigue',
      'Physical Fatigue vs Mental Fatigue',
      'Recognising and Preventing Burnout',
      'Shift Work and Fatigue Management',
      'The Role of Hydration in Energy Levels',
    ],
  },
  {
    category: 'Healthy Sleep',
    color: '#7C3AED',
    topics: [
      'Building a Healthy Sleep Routine',
      'Effects of Sleep Deprivation on Health',
      'How Screen Time Affects Sleep Quality',
      'Managing Insomnia Naturally',
      'Shift Work and Sleep Disorders',
      'Sleep Apnoea: Awareness and Treatment',
      'Sleep and Mental Health',
      'Sleep and Weight Management',
      'The Science of Sleep Cycles',
      'Tips for Better Sleep Hygiene',
    ],
  },
  {
    category: 'Communicable Diseases',
    color: '#DC2626',
    topics: [
      'Cholera: Prevention and Control',
      'COVID-19: Prevention and Management',
      'Hepatitis B and C Awareness',
      'HIV/AIDS: Prevention, Treatment and Living with HIV',
      'Lassa Fever Awareness',
      'Malaria Prevention and Treatment',
      'Monkeypox Awareness',
      'Prevention of Sexually Transmitted Infections (STIs)',
      'Tuberculosis (TB) Awareness',
      'Typhoid Fever Prevention',
      'Understanding Meningitis',
      'Yellow Fever and Vaccination',
    ],
  },
  {
    category: 'Non-Communicable Diseases',
    color: '#2563EB',
    topics: [
      'Arthritis: Types, Symptoms and Management',
      'Cancer Awareness and Early Detection',
      'Cervical Cancer and HPV Prevention',
      'Colorectal Cancer Awareness',
      'Diabetes: Prevention, Management and Complications',
      'Epilepsy Awareness and Management',
      'Heart Disease Prevention',
      'Hypertension: Causes, Risks and Management',
      'Kidney Disease Awareness',
      'Liver Disease and Prevention',
      'Lung Health and COPD',
      'Obesity and Metabolic Syndrome',
      'Prostate Cancer Awareness',
      'Stroke: Prevention, Recognition and Response',
      'Thyroid Disorders Awareness',
      'Understanding Sickle Cell Disease',
    ],
  },
  {
    category: 'Mental Wellness',
    color: '#0891B2',
    topics: [
      'Anxiety Disorders: Recognising and Managing Anxiety',
      'Building Emotional Resilience',
      'Burnout: Causes, Symptoms and Recovery',
      'Dealing with Grief and Loss',
      'Depression: Awareness and Support',
      'Managing Work-Life Balance',
      'Mental Health First Aid in the Workplace',
      'Post-Traumatic Stress Disorder (PTSD) Awareness',
      'Stress and Coping Strategies',
      'Suicide Prevention Awareness',
      'Understanding and Reducing Stigma around Mental Illness',
      'Well-being and Self-Care Strategies',
    ],
  },
];

//  Request logs
//
// Both logs below start empty and only hold what HR submitted since the page
// loaded. Prognosis has no endpoint that lists previously submitted wellness
// requests, so there is nothing to load them from: the alternative was the
// invented rows that used to sit here, which read as a history HR could act on.

interface TalkLogRow {
  id: number; category: string; topic: string; format: string;
  requestedDate: string; scheduledDate: string; status: string;
}

interface SentLinkRow {
  id: number; name: string; email: string; spouse: boolean; sentDate: string; status: string;
}

const TALK_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Requested: { bg: '#FFFBEB', text: '#D97706' },
  Confirmed: { bg: '#EFF6FF', text: '#2563EB' },
  Completed: { bg: '#ECFDF5', text: '#059669' },
  Cancelled: { bg: '#FEF2F2', text: '#DC2626' },
};

/** "7 Aug 2026", the format used by the rest of the portal. */
function shortDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

//  Helpers

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
  Requested: { bg: '#FFFBEB', text: '#D97706' },
  Pending:   { bg: '#FFFBEB', text: '#D97706' },
  Booked:    { bg: '#EFF6FF', text: '#2563EB' },
  Completed: { bg: '#ECFDF5', text: '#059669' },
};

type Tab = 'talks' | 'screening' | 'dashboard';

//  Page

export default function WellnessPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('talks');

  // Health talks form
  const [talkType, setTalkType]       = useState<'onsite' | 'virtual'>('onsite');
  const [talkCategory, setTalkCategory] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [talkTopic, setTalkTopic]     = useState('');
  const [talkDate, setTalkDate]       = useState('');
  const [talkDuration, setTalkDuration] = useState('60');
  const [talkAttendees, setTalkAttendees] = useState('');
  const [talkNotes, setTalkNotes]     = useState('');
  const [talkSent, setTalkSent]       = useState(false);
  const [talkSubmitting, setTalkSubmitting] = useState(false);
  const [talkError, setTalkError]     = useState<string | null>(null);
  const [talkLog, setTalkLog]         = useState<TalkLogRow[]>([]);

  // Onsite screening form
  const [scrParticipants, setScrParticipants] = useState('');
  const [scrDate, setScrDate]         = useState('');
  const [scrVenue, setScrVenue]       = useState('');
  const [scrNotes, setScrNotes]       = useState('');
  const [scrSent, setScrSent]         = useState(false);
  const [scrSubmitting, setScrSubmitting] = useState(false);
  const [scrError, setScrError]       = useState<string | null>(null);

  // Send screening link form: member search
  const [linkQuery, setLinkQuery]         = useState('');
  const [linkResults, setLinkResults]     = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [linkSpouse, setLinkSpouse]         = useState(false);
  const [linkSpouseEmail, setLinkSpouseEmail] = useState('');
  const [linkMessage, setLinkMessage]       = useState('');
  const [linkSent, setLinkSent]             = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError]           = useState<string | null>(null);
  const [sentLinks, setSentLinks]           = useState<SentLinkRow[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // The real scheme roster, for the member search and the eligible-lives count.
  // This is the same source the People page reads, with skipClaims=1 because
  // neither of those two things needs claim history.
  const [roster, setRoster]           = useState<Member[] | null>(null);
  const [eligible, setEligible]       = useState<number | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setLinkResults([]);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // One fetch on mount to fill the roster.
  useEffect(() => {
    fetch('/api/hr/members?skipClaims=1')
      .then((r) => r.json())
      .then((d: { members?: Member[]; stats?: { principalCount?: number }; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setRoster(d.members ?? []);
        setEligible(typeof d.stats?.principalCount === 'number' ? d.stats.principalCount : null);
      })
      .catch((e) => {
        setRoster([]);
        setRosterError(e instanceof Error ? e.message : 'Could not load your staff list.');
      });
  }, []);

  function handleLinkSearch(q: string) {
    setLinkQuery(q);
    setSelectedMember(null);
    if (!q.trim()) { setLinkResults([]); return; }
    const lower = q.toLowerCase();
    const principals = (roster ?? []).filter((m) => m.type === 'Principal' && isCoveredStatus(m.status));
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

  const card: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #DEE3ED', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
  const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };
  const focusIn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; };
  const focusOut = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; };

  const tabs: { key: Tab; label: string; Icon: React.ElementType }[] = [
    { key: 'talks',     label: 'Health Talks',       Icon: Activity    },
    { key: 'screening', label: 'Health Screenings',  Icon: Stethoscope },
    { key: 'dashboard', label: 'Screening Dashboard', Icon: TrendingUp  },
  ];

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Wellness" subtitle="Health Talks · Screenings · Annual Medical" />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* TAB SWITCHER */}
        <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #DEE3ED', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
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

        {/*  HEALTH TALKS  */}
        {activeTab === 'talks' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 20, alignItems: 'start' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Topic Category</label>
                  <select
                    value={talkCategory}
                    onChange={(e) => { setTalkCategory(e.target.value); setTalkTopic(''); }}
                    style={{ ...inputStyle, appearance: 'none' }}
                    onFocus={focusIn} onBlur={focusOut}
                  >
                    <option value="">Select a category...</option>
                    {HEALTH_TALK_CATEGORIES.map((c) => (
                      <option key={c.category} value={c.category}>{c.category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Talk Topic</label>
                  <select
                    value={talkTopic}
                    onChange={(e) => setTalkTopic(e.target.value)}
                    disabled={!talkCategory}
                    style={{ ...inputStyle, appearance: 'none', opacity: talkCategory ? 1 : 0.5, cursor: talkCategory ? 'pointer' : 'not-allowed' }}
                    onFocus={focusIn} onBlur={focusOut}
                  >
                    <option value="">{talkCategory ? 'Select a topic...' : 'Choose a category first'}</option>
                    {(HEALTH_TALK_CATEGORIES.find((c) => c.category === talkCategory)?.topics ?? []).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
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
                disabled={talkSubmitting || !talkTopic || !talkDate || !talkAttendees}
                onClick={async () => {
                  if (!talkTopic || !talkDate || !talkAttendees) return;
                  setTalkSubmitting(true); setTalkError(null);
                  try {
                    const res = await fetch('/api/hr/wellness/request', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'talk', talkFormat: talkType, talkCategory, talkTopic, talkDate, talkDuration, talkAttendees, talkVenue: talkNotes }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? 'Failed to send');
                    toast('Health talk request sent to Client Services.', 'success');
                    setTalkLog((prev) => [{ id: Date.now(), category: talkCategory, topic: talkTopic, format: talkType === 'onsite' ? 'Onsite' : 'Virtual', requestedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), scheduledDate: talkDate ? new Date(talkDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-', status: 'Requested' }, ...prev]);
                    setTalkSent(true); setTalkCategory(''); setTalkTopic(''); setTalkDate(''); setTalkAttendees(''); setTalkNotes('');
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Failed to send request';
                    setTalkError(msg);
                    toast(msg, 'error');
                  } finally {
                    setTalkSubmitting(false);
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: talkSubmitting ? 'wait' : 'pointer', opacity: (!talkTopic || !talkDate || !talkAttendees) ? 0.5 : 1, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 10px rgba(245,107,34,0.32)', transition: 'opacity 0.2s' }}>
                <Send style={{ width: 14, height: 14 }} /> {talkSubmitting ? 'Sending...' : 'Send Request to Client Services'}
              </button>

              {talkError && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, marginTop: 16 }}><p style={{ fontSize: 13, color: '#DC2626' }}>{talkError}</p></div>}
              {talkSent && <SuccessBanner message="Request sent to clientservices@leadway.com: they will reach out within 1 business day to confirm." />}
            </div>

            {/* Topic browser sidebar: accordion */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F1F5' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>Leadway HMO Topic Library</p>
                <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>Click a category to browse topics</p>
              </div>
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                {HEALTH_TALK_CATEGORIES.map((cat) => {
                  const isOpen = expandedCats.has(cat.category);
                  return (
                    <div key={cat.category} style={{ borderBottom: '1px solid #F7F8FA' }}>
                      {/* Category header */}
                      <button
                        onClick={() => {
                          const next = new Set(expandedCats);
                          if (isOpen) next.delete(cat.category); else next.add(cat.category);
                          setExpandedCats(next);
                        }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#131C4E' }}>{cat.category}</span>
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3B8', background: '#F0F1F5', borderRadius: 99, padding: '1px 7px' }}>{cat.topics.length}</span>
                        </div>
                        <span style={{ fontSize: 14, color: '#9CA3B8', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                      </button>

                      {/* Topics */}
                      {isOpen && (
                        <div style={{ padding: '4px 20px 12px 20px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {cat.topics.map((t) => {
                            const sel = talkTopic === t && talkCategory === cat.category;
                            return (
                              <button
                                key={t}
                                onClick={() => { setTalkCategory(cat.category); setTalkTopic(t); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: sel ? `${cat.color}12` : 'transparent', border: sel ? `1px solid ${cat.color}40` : '1px solid transparent', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.1s' }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: sel ? cat.color : '#D1D5DB', flexShrink: 0 }} />
                                <span style={{ fontSize: 11.5, color: sel ? cat.color : '#374151', fontWeight: sel ? 600 : 400 }}>{t}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/*  HEALTH SCREENINGS  */}
        {activeTab === 'screening' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

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
                  disabled={scrSubmitting || !scrParticipants || !scrDate || !scrVenue}
                  onClick={async () => {
                    if (!scrParticipants || !scrDate || !scrVenue) return;
                    setScrSubmitting(true); setScrError(null);
                    try {
                      const res = await fetch('/api/hr/wellness/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'screening', scrParticipants, scrDate, scrVenue, scrNotes }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
                      toast('Screening request sent to Client Services.', 'success');
                      setScrSent(true); setScrParticipants(''); setScrDate(''); setScrVenue(''); setScrNotes('');
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : 'Failed to send request';
                      setScrError(msg);
                      toast(msg, 'error');
                    } finally {
                      setScrSubmitting(false);
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: scrSubmitting ? 'wait' : 'pointer', opacity: (!scrParticipants || !scrDate || !scrVenue) ? 0.5 : 1, background: 'linear-gradient(135deg,#2563EB,#3B82F6)', boxShadow: '0 2px 10px rgba(37,99,235,0.28)', transition: 'opacity 0.2s' }}>
                  <Send style={{ width: 14, height: 14 }} /> {scrSubmitting ? 'Sending...' : 'Submit to Client Services'}
                </button>
                {scrError && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, marginTop: 16 }}><p style={{ fontSize: 13, color: '#DC2626' }}>{scrError}</p></div>}
                {scrSent && <SuccessBanner message="Screening request sent to clientservices@leadway.com: they will confirm logistics within 2 business days." />}
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
                    <label style={labelStyle}>Search Member by Name or Enrolee ID</label>
                    <div style={{ position: 'relative' }}>
                      <Search style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#9CA3B8', pointerEvents: 'none' }} />
                      <input
                        value={linkQuery}
                        onChange={(e) => handleLinkSearch(e.target.value)}
                        placeholder="Type name or enrolee ID..."
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

                    {/* This searches the real scheme roster now, so it has to say
                        when the roster is still arriving or failed to load, rather
                        than looking like a search that found nobody. Hidden while
                        the dropdown is open so the dropdown stays anchored to the
                        input: it is positioned against this whole block. */}
                    {!selectedMember && linkResults.length === 0 && (
                      <p style={{ fontSize: 11, color: rosterError ? '#DC2626' : '#9CA3B8', marginTop: 6, lineHeight: 1.5 }}>
                        {rosterError
                          ? `Staff list unavailable. ${rosterError}`
                          : roster === null
                            ? 'Loading your staff list...'
                            : linkQuery.trim()
                              ? 'No active staff match that name or enrolee ID.'
                              : `Searching ${roster.filter((m) => m.type === 'Principal' && isCoveredStatus(m.status)).length.toLocaleString()} active staff on your scheme.`}
                      </p>
                    )}

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
                        <textarea value={linkMessage} onChange={(e) => setLinkMessage(e.target.value)} rows={2} placeholder="Add a short note to accompany the link..." style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'none', fontFamily: 'inherit' }} onFocus={focusIn} onBlur={focusOut} />
                      </div>
                    </>
                  )}
                </div>
                <button
                  disabled={!selectedMember || linkSubmitting}
                  onClick={async () => {
                    if (!selectedMember) return;
                    if (linkSpouse && !linkSpouseEmail.trim()) {
                      setLinkError('Add the spouse email, or switch Include Spouse off.');
                      toast('Add the spouse email, or switch Include Spouse off.', 'error');
                      return;
                    }
                    const member = selectedMember;
                    const memberName = `${member.firstName} ${member.lastName}`;
                    setLinkSubmitting(true); setLinkError(null);
                    try {
                      const res = await fetch('/api/hr/wellness/request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          type: 'bookingLink',
                          memberName,
                          memberId: member.employeeId,
                          memberEmail: member.email,
                          memberPlan: member.plan,
                          includeSpouse: linkSpouse,
                          spouseEmail: linkSpouse ? linkSpouseEmail.trim() : '',
                          linkMessage,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
                      toast(`Booking link requested for ${memberName}.`, 'success');
                      setSentLinks((prev) => [{
                        id: Date.now(), name: memberName, email: member.email,
                        spouse: linkSpouse, sentDate: shortDate(new Date()), status: 'Requested',
                      }, ...prev]);
                      setSelectedMember(null); setLinkQuery(''); setLinkSpouse(false); setLinkSpouseEmail(''); setLinkMessage('');
                      setLinkSent(true); setTimeout(() => setLinkSent(false), 6000);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : 'Failed to send request';
                      setLinkError(msg);
                      toast(msg, 'error');
                    } finally {
                      setLinkSubmitting(false);
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: linkSubmitting ? 'wait' : selectedMember ? 'pointer' : 'not-allowed', opacity: selectedMember ? 1 : 0.45, background: 'linear-gradient(135deg,#059669,#10B981)', boxShadow: selectedMember ? '0 2px 10px rgba(5,150,105,0.28)' : 'none', transition: 'all 0.2s' }}>
                  <Mail style={{ width: 14, height: 14 }} /> {linkSubmitting ? 'Sending...' : 'Request Booking Link'}
                </button>
                {linkError && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, marginTop: 16 }}><p style={{ fontSize: 13, color: '#DC2626' }}>{linkError}</p></div>}
                {linkSent && <SuccessBanner message="Sent to clientservices@leadway.com, with you in copy. They issue the booking link to the member." />}
              </div>

              {/* Requests raised from this session. Prognosis has no endpoint that
                  lists past booking-link requests, so this is a record of what
                  was sent since the page loaded and says so. */}
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F1F5' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>Booking Links Requested</p>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>Requests you have raised since opening this page</p>
                </div>
                {sentLinks.length === 0 && (
                  <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: 12.5, color: '#9CA3B8', lineHeight: 1.6 }}>
                      Nothing requested yet. Search for a member above to request their booking link.
                    </p>
                  </div>
                )}
                {sentLinks.slice(0, 6).map((l, i) => {
                  const sc = statusColors[l.status] ?? statusColors['Pending'];
                  return (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: i < Math.min(sentLinks.length, 6) - 1 ? '1px solid #F7F8FA' : 'none' }}>
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

        {/*  SCREENING DASHBOARD  */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* One real figure and an explanation of what is missing, in place of
                the six invented counts that used to sit here. The eligible count
                is the active principal count from the scheme roster; screening
                completions live in Leadway's clinical system and no endpoint
                publishes them to the portal, so there is nothing honest to put
                in a coverage bar yet. */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 16, alignItems: 'stretch' }}>
              <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Eligible for Annual Screening</p>
                <p style={{ fontSize: 36, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {rosterError ? 'Unavailable' : eligible === null ? '...' : eligible.toLocaleString()}
                </p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 6, lineHeight: 1.5 }}>
                  {rosterError
                    ? 'Your staff list could not be loaded. Reload the page to try again.'
                    : 'Active staff on your scheme. Each is entitled to one annual medical.'}
                </p>
              </div>

              <div style={{ ...card, padding: '22px 24px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Info style={{ width: 17, height: 17, color: '#2563EB' }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>Screening results are not published to the portal yet</p>
                  <p style={{ fontSize: 12.5, color: '#6B7280', marginTop: 6, lineHeight: 1.65 }}>
                    Completed annual medicals are recorded by the screening provider and held in Leadway Health&apos;s
                    clinical system. There is no feed into the portal, so this tab can tell you who is eligible but not
                    who has attended. For a completion list covering your scheme, ask your account manager for the
                    screening report.
                  </p>
                  <p style={{ fontSize: 12.5, color: '#6B7280', marginTop: 8, lineHeight: 1.65 }}>
                    Requests you raise here are logged below and go straight to client services.
                  </p>
                </div>
              </div>
            </div>

            {/* Screening completions: the frame stays so it is clear what will
                appear here, but with no rows rather than invented ones. */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Screening Completions</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Staff who have attended their annual medical</p>
              </div>
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: '#F0F1F5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Stethoscope style={{ width: 20, height: 20, color: '#9CA3B8' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>No completion records available</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 4, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
                  Attendance is captured by the screening provider, not the portal. This list fills in once that
                  feed is connected.
                </p>
              </div>
            </div>

            {/* Health Talks Log */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #F0F1F5' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Health Talk Requests</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>Topics requested, scheduled dates and confirmation status</p>
                </div>
                <button onClick={() => setActiveTab('talks')} style={{ fontSize: 12, fontWeight: 600, color: '#F56B22', background: '#FFF5EF', border: '1px solid #FFCFB0', borderRadius: 99, padding: '5px 14px', cursor: 'pointer' }}>
                  + New Request
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', columnGap: 12, padding: '10px 24px', background: '#FAFBFC', borderBottom: '1px solid #F0F1F5' }}>
                {['Topic', 'Category', 'Format', 'Requested', 'Scheduled', 'Status'].map((h) => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>
              {talkLog.length === 0 && (
                <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                  <p style={{ fontSize: 13, color: '#9CA3B8' }}>No health talk requests yet. Submit one from the Health Talks tab.</p>
                </div>
              )}
              {talkLog.map((t, i) => {
                const sc = TALK_STATUS_COLORS[t.status] ?? TALK_STATUS_COLORS['Requested'];
                return (
                  <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', columnGap: 12, alignItems: 'center', padding: '14px 24px', borderBottom: i < talkLog.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.category}</p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600,
                      color: t.format === 'Onsite' ? '#F56B22' : '#7C3AED',
                      background: t.format === 'Onsite' ? '#FFF5EF' : '#F5F3FF',
                      padding: '3px 10px', borderRadius: 8, width: 'fit-content' }}>
                      {t.format === 'Onsite' ? <MapPin style={{ width: 10, height: 10 }} /> : <Video style={{ width: 10, height: 10 }} />}
                      {t.format}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock style={{ width: 11, height: 11, color: '#9CA3B8' }} />
                      <span style={{ fontSize: 11, color: '#9CA3B8' }}>{t.requestedDate}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock style={{ width: 11, height: 11, color: t.scheduledDate === '-' ? '#D1D5DB' : '#059669' }} />
                      <span style={{ fontSize: 11, color: t.scheduledDate === '-' ? '#D1D5DB' : '#059669', fontWeight: t.scheduledDate === '-' ? 400 : 600 }}>{t.scheduledDate}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: sc.bg, color: sc.text, width: 'fit-content' }}>{t.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
