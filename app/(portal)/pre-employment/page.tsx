'use client';

import { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import {
  UserCheck, MapPin, CheckSquare, Calendar, Send, CheckCircle,
  Building2, ChevronDown, X, ClipboardList,
} from 'lucide-react';

// ── Facilities by state ───────────────────────────────────────────────────────

const FACILITIES_BY_STATE: Record<string, { name: string; address: string; type: string }[]> = {
  'Lagos': [
    { name: 'Reddington Hospital',         address: 'Lekki Phase 1, Lagos',           type: 'Hospital' },
    { name: 'St. Nicholas Hospital',        address: 'Victoria Island, Lagos',         type: 'Hospital' },
    { name: 'Premium Health Centre',        address: 'Ikeja GRA, Lagos',               type: 'Clinic'   },
    { name: 'Lagoon Hospital Apapa',        address: 'Apapa, Lagos',                   type: 'Hospital' },
  ],
  'Abuja (FCT)': [
    { name: 'National Hospital Abuja',      address: 'Central Business District',      type: 'Hospital' },
    { name: 'Garki Hospital',               address: 'Garki Area 1, Abuja',            type: 'Hospital' },
    { name: 'Maitama District Hospital',    address: 'Maitama, Abuja',                 type: 'Hospital' },
  ],
  'Rivers': [
    { name: 'Braithwaite Memorial Hospital', address: 'Moscow Road, Port Harcourt',   type: 'Hospital' },
    { name: 'Meridian Health Centre',        address: 'GRA Phase 2, Port Harcourt',   type: 'Clinic'   },
    { name: 'UPTH',                          address: 'Choba, Port Harcourt',          type: 'Hospital' },
  ],
  'Oyo': [
    { name: 'University College Hospital',  address: "Queen's Road, Ibadan",           type: 'Hospital' },
    { name: 'Adeoyo Maternity Hospital',    address: 'Ring Road, Ibadan',              type: 'Hospital' },
    { name: 'Ring Road State Hospital',     address: 'Ibadan',                         type: 'Hospital' },
  ],
  'Kano': [
    { name: 'Aminu Kano Teaching Hospital', address: 'Zaria Road, Kano',              type: 'Hospital' },
    { name: 'Murtala Muhammad Specialist',  address: 'Kano Metropolis',               type: 'Hospital' },
  ],
  'Edo': [
    { name: 'UBTH',                         address: 'Uselu, Benin City',              type: 'Hospital' },
    { name: 'Central Hospital Benin',       address: 'Benin City',                     type: 'Hospital' },
  ],
  'Enugu': [
    { name: 'ESUT Teaching Hospital',       address: 'Enugu',                          type: 'Hospital' },
    { name: 'Park Lane Hospital',           address: 'GRA, Enugu',                     type: 'Hospital' },
  ],
  'Delta': [
    { name: 'DELSUTH',                      address: 'Oghara, Delta',                  type: 'Hospital' },
    { name: 'Central Hospital Warri',       address: 'Warri',                          type: 'Hospital' },
  ],
  'Kaduna': [
    { name: 'Barau Dikko Teaching Hospital', address: 'Kaduna',                        type: 'Hospital' },
    { name: 'St. Gerard Catholic Hospital',  address: 'Kaduna',                        type: 'Hospital' },
  ],
  'Anambra': [
    { name: 'NAUTH Nnewi',                  address: 'Nnewi, Anambra',                 type: 'Hospital' },
    { name: 'COOUTH Awka',                  address: 'Awka, Anambra',                  type: 'Hospital' },
  ],
  'Cross River': [
    { name: 'University of Calabar Teaching Hospital', address: 'Calabar',            type: 'Hospital' },
    { name: 'General Hospital Calabar',     address: 'Calabar',                        type: 'Hospital' },
  ],
  'Imo': [
    { name: 'IMSUTH Orlu',                  address: 'Orlu, Imo',                      type: 'Hospital' },
    { name: 'Federal Medical Centre Owerri', address: 'Owerri',                        type: 'Hospital' },
  ],
  'Kwara': [
    { name: 'University of Ilorin Teaching Hospital', address: 'Ilorin',               type: 'Hospital' },
    { name: 'General Hospital Ilorin',      address: 'Ilorin',                         type: 'Hospital' },
  ],
  'Ogun': [
    { name: 'Olabisi Onabanjo University Teaching Hospital', address: 'Sagamu',        type: 'Hospital' },
    { name: 'Federal Medical Centre Abeokuta', address: 'Abeokuta',                    type: 'Hospital' },
  ],
};

const NIGERIAN_STATES = [
  'Abuja (FCT)', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

// ── Tests ─────────────────────────────────────────────────────────────────────

type Gender = 'Male' | 'Female' | '';

const ALL_TESTS: { id: string; label: string; gender: 'all' | 'male' | 'female'; category: string }[] = [
  // Haematology
  { id: 'fbc',       label: 'Full Blood Count (FBC)',               gender: 'all',    category: 'Haematology'  },
  { id: 'blood-grp', label: 'Blood Group & Genotype',               gender: 'all',    category: 'Haematology'  },
  { id: 'esr',       label: 'Erythrocyte Sedimentation Rate (ESR)', gender: 'all',    category: 'Haematology'  },
  // Biochemistry
  { id: 'urinalysis',label: 'Urinalysis',                           gender: 'all',    category: 'Biochemistry' },
  { id: 'fbs',       label: 'Fasting Blood Sugar (FBS)',            gender: 'all',    category: 'Biochemistry' },
  { id: 'lipid',     label: 'Lipid Profile',                        gender: 'all',    category: 'Biochemistry' },
  { id: 'lft',       label: 'Liver Function Test (LFT)',            gender: 'all',    category: 'Biochemistry' },
  { id: 'kft',       label: 'Kidney Function Test (KFT)',           gender: 'all',    category: 'Biochemistry' },
  { id: 'uric',      label: 'Uric Acid',                            gender: 'all',    category: 'Biochemistry' },
  // Serology
  { id: 'hiv',       label: 'HIV 1 & 2 Screening',                  gender: 'all',    category: 'Serology'     },
  { id: 'hep-b',     label: 'Hepatitis B Surface Antigen (HBsAg)',  gender: 'all',    category: 'Serology'     },
  { id: 'hep-c',     label: 'Hepatitis C Antibody',                 gender: 'all',    category: 'Serology'     },
  { id: 'vdrl',      label: 'VDRL (Syphilis)',                       gender: 'all',    category: 'Serology'     },
  { id: 'pregnancy', label: 'Pregnancy Test (Serum HCG)',           gender: 'female', category: 'Serology'     },
  // Radiology
  { id: 'xray',      label: 'Chest X-Ray',                          gender: 'all',    category: 'Radiology'    },
  // Cardiology
  { id: 'ecg',       label: 'Electrocardiogram (ECG)',              gender: 'all',    category: 'Cardiology'   },
  // Clinical
  { id: 'bmi',       label: 'Blood Pressure & BMI',                 gender: 'all',    category: 'Clinical'     },
  { id: 'vision',    label: 'Vision & Eye Test',                    gender: 'all',    category: 'Clinical'     },
  { id: 'hearing',   label: 'Hearing Test (Audiometry)',            gender: 'all',    category: 'Clinical'     },
  { id: 'musculo',   label: 'Musculoskeletal Examination',          gender: 'all',    category: 'Clinical'     },
  // Toxicology
  { id: 'drug',      label: 'Drug & Substance Abuse Screening',     gender: 'all',    category: 'Toxicology'   },
  // Female-specific
  { id: 'pap',       label: 'Pap Smear (Cervical Cytology)',        gender: 'female', category: 'Gynaecology'  },
  { id: 'breast',    label: 'Breast Examination',                   gender: 'female', category: 'Gynaecology'  },
  // Male-specific
  { id: 'psa',       label: 'PSA (Prostate Specific Antigen)',      gender: 'male',   category: 'Urology'      },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Haematology:  { bg: '#FEF2F2', text: '#DC2626' },
  Biochemistry: { bg: '#FFFBEB', text: '#D97706' },
  Serology:     { bg: '#F5F3FF', text: '#7C3AED' },
  Radiology:    { bg: '#EFF6FF', text: '#2563EB' },
  Cardiology:   { bg: '#FFF1F2', text: '#BE123C' },
  Clinical:     { bg: '#ECFDF5', text: '#059669' },
  Toxicology:   { bg: '#F1F5F9', text: '#475569' },
  Gynaecology:  { bg: '#FDF4FF', text: '#9333EA' },
  Urology:      { bg: '#F0FDFA', text: '#0F766E' },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PreEmploymentPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', gender: '' as Gender,
    dob: '', state: '', notes: '', date: '',
  });
  const [selectedFacility, setSelectedFacility] = useState<{ name: string; address: string; type: string } | null>(null);
  const [selectedTests, setSelectedTests]       = useState<Set<string>>(new Set());
  const [submitted, setSubmitted]               = useState(false);

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (k === 'state') setSelectedFacility(null);
    if (k === 'gender') {
      // remove tests that no longer apply when gender changes
      setSelectedTests((prev) => {
        const next = new Set(prev);
        ALL_TESTS.forEach((t) => {
          if (t.gender === 'female' && v !== 'Female') next.delete(t.id);
          if (t.gender === 'male'   && v !== 'Male')   next.delete(t.id);
        });
        return next;
      });
    }
  };

  const facilities = form.state ? (FACILITIES_BY_STATE[form.state] ?? []) : [];

  const visibleTests = ALL_TESTS.filter((t) =>
    t.gender === 'all' ||
    (t.gender === 'female' && form.gender === 'Female') ||
    (t.gender === 'male'   && form.gender === 'Male')
  );

  const categories = [...new Set(visibleTests.map((t) => t.category))];

  function toggleTest(id: string) {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllInCategory(cat: string) {
    const ids = visibleTests.filter((t) => t.category === cat).map((t) => t.id);
    setSelectedTests((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  const canSubmit = form.name && form.email && form.phone && form.gender && form.dob && form.state && selectedFacility && selectedTests.size > 0 && form.date;

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitted(true);
  }

  function reset() {
    setForm({ name: '', email: '', phone: '', gender: '', dob: '', state: '', notes: '', date: '' });
    setSelectedFacility(null); setSelectedTests(new Set()); setSubmitted(false);
  }

  const card: React.CSSProperties  = { background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
  const inputStyle: React.CSSProperties = { width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9CA3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' };
  const fi = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; };
  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; };

  if (submitted) {
    return (
      <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
        <TopBar title="Pre-employment Screening" subtitle="Candidate medical screening & fitness certification" />
        <div style={{ padding: '60px 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle style={{ width: 36, height: 36, color: '#059669' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#131C4E' }}>Quote Request Sent!</p>
            <p style={{ fontSize: 14, color: '#6B7280', marginTop: 8, maxWidth: 480 }}>
              Your pre-employment screening request for <strong>{form.name}</strong> has been sent to the Leadway Health client services desk. You will receive a quote and confirmation within 1 business day.
            </p>
          </div>
          <div style={{ ...card, padding: '20px 28px', maxWidth: 480, width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Candidate',  value: form.name },
                { label: 'Facility',   value: `${selectedFacility?.name} — ${selectedFacility?.address}` },
                { label: 'State',      value: form.state },
                { label: 'Preferred Date', value: form.date },
                { label: 'Tests',      value: `${selectedTests.size} test${selectedTests.size !== 1 ? 's' : ''} selected` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13 }}>
                  <span style={{ color: '#9CA3B8', fontWeight: 600 }}>{label}</span>
                  <span style={{ color: '#131C4E', fontWeight: 600, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={reset}
            style={{ height: 42, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 10px rgba(245,107,34,0.28)' }}>
            New Screening Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Pre-employment Screening" subtitle="Candidate medical screening & fitness certification" />

      <div style={{ padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── SECTION 1: Candidate Details ── */}
        <div style={{ ...card, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck style={{ width: 17, height: 17, color: '#F56B22' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Candidate Details</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Enter the candidate&apos;s personal information</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Abiodun Ogunleye" style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="candidate@email.com" style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+234 800 000 0000" style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)} style={{ ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', color: form.gender ? '#131C4E' : '#9CA3B8' }} onFocus={fi} onBlur={fo}>
                <option value="">Select gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date of Birth</label>
              <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <select value={form.state} onChange={(e) => set('state', e.target.value)} style={{ ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', color: form.state ? '#131C4E' : '#9CA3B8' }} onFocus={fi} onBlur={fo}>
                <option value="">Select state</option>
                {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Facilities (appears once state is selected) ── */}
        {form.state && (
          <div style={{ ...card, padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 style={{ width: 17, height: 17, color: '#2563EB' }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Select Screening Facility</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>Accredited Leadway Health facilities in <strong>{form.state}</strong></p>
              </div>
            </div>
            {facilities.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {facilities.map((f) => {
                  const isSelected = selectedFacility?.name === f.name;
                  return (
                    <button key={f.name} onClick={() => setSelectedFacility(isSelected ? null : f)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '16px 18px', borderRadius: 14, border: `1.5px solid ${isSelected ? '#F56B22' : '#E5E7F1'}`, background: isSelected ? '#FFF5EF' : '#FAFBFC', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', position: 'relative' }}>
                      {isSelected && <CheckCircle style={{ position: 'absolute', top: 12, right: 12, width: 16, height: 16, color: '#F56B22' }} />}
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: isSelected ? '#FFF1E6' : '#F1F2F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 style={{ width: 15, height: 15, color: isSelected ? '#F56B22' : '#6B7280' }} />
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{f.name}</p>
                      <p style={{ fontSize: 11, color: '#9CA3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin style={{ width: 10, height: 10 }} />{f.address}
                      </p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#EFF6FF', color: '#2563EB', width: 'fit-content' }}>{f.type}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px', background: '#FAFBFC', borderRadius: 12, border: '1px dashed #E5E7F1', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#9CA3B8' }}>No pre-listed facilities for <strong>{form.state}</strong>. Include your preferred venue in the notes and Leadway Health will confirm availability.</p>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 3: Tests (appears once gender is selected) ── */}
        {form.gender && (
          <div style={{ ...card, padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList style={{ width: 17, height: 17, color: '#7C3AED' }} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Select Tests</p>
                  <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>
                    Showing tests for <strong>{form.gender}</strong> candidates · {selectedTests.size} selected
                  </p>
                </div>
              </div>
              {selectedTests.size > 0 && (
                <button onClick={() => setSelectedTests(new Set())}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#9CA3B8', background: 'none', border: '1px solid #E5E7F1', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                  <X style={{ width: 12, height: 12 }} /> Clear all
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {categories.map((cat) => {
                const catTests = visibleTests.filter((t) => t.category === cat);
                const cc = CATEGORY_COLORS[cat] ?? { bg: '#F7F8FC', text: '#6B7280' };
                const allCatSelected = catTests.every((t) => selectedTests.has(t.id));
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: cc.bg, color: cc.text }}>{cat}</span>
                      <button onClick={() => allCatSelected ? catTests.forEach((t) => setSelectedTests((p) => { const n = new Set(p); n.delete(t.id); return n; })) : selectAllInCategory(cat)}
                        style={{ fontSize: 11, fontWeight: 600, color: allCatSelected ? '#9CA3B8' : cc.text, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {allCatSelected ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {catTests.map((t) => {
                        const on = selectedTests.has(t.id);
                        return (
                          <button key={t.id} onClick={() => toggleTest(t.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${on ? cc.text : '#E5E7F1'}`, background: on ? cc.bg : '#FAFBFC', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                            <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${on ? cc.text : '#D1D5DB'}`, background: on ? cc.text : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                              {on && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: on ? 600 : 500, color: on ? '#131C4E' : '#6B7280', lineHeight: 1.4 }}>{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SECTION 4: Date, Notes & Submit ── */}
        <div style={{ ...card, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar style={{ width: 17, height: 17, color: '#059669' }} />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Preferred Date & Notes</p>
              <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 1 }}>When should the candidate attend?</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Preferred Screening Date</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} style={inputStyle} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={labelStyle}>Additional Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Any special requirements or instructions for the candidate…" style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'none', fontFamily: 'inherit' }} onFocus={fi} onBlur={fo} />
            </div>
          </div>
        </div>

        {/* ── SUBMIT BAR ── */}
        <div style={{ ...card, padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ flex: 1 }}>
            {canSubmit ? (
              <p style={{ fontSize: 13, color: '#374151' }}>
                Ready to request a quote for <strong>{form.name}</strong> at <strong>{selectedFacility?.name}</strong> on <strong>{form.date}</strong> · <strong>{selectedTests.size} test{selectedTests.size !== 1 ? 's' : ''}</strong>
              </p>
            ) : (
              <p style={{ fontSize: 13, color: '#9CA3B8' }}>
                Complete all sections above — candidate details, facility, tests and date — to request a quote.
              </p>
            )}
          </div>
          <button onClick={handleSubmit} disabled={!canSubmit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#fff', border: 'none', borderRadius: 24, cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.45, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: canSubmit ? '0 2px 10px rgba(245,107,34,0.32)' : 'none', transition: 'all 0.2s', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Send style={{ width: 14, height: 14 }} /> Get Quote from Leadway
          </button>
        </div>

      </div>
    </div>
  );
}
