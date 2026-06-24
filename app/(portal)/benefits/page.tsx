'use client';

import React, { useState } from 'react';
import { Search, MapPin, Phone, CheckCircle, XCircle, Activity, Building2, Heart, Smile, Eye, FlaskConical, AlertTriangle, FileText } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';

type Plan = 'Gold Plus' | 'Silver' | 'Bronze';

const benefits: Record<Plan, { category: string; limit: string; includes: string[]; excludes: string[]; waitingPeriod?: string }[]> = {
  'Gold Plus': [
    { category: 'Outpatient', limit: 'Unlimited visits', includes: ['GP Consultation', 'Diagnostics', 'Drugs (formulary)'], excludes: ['Cosmetic procedures'] },
    { category: 'Inpatient',  limit: '₦5,000,000 / yr',  includes: ['Surgery', 'ICU', 'Physiotherapy'], excludes: ['Pre-existing (yr 1)'], waitingPeriod: '3 months' },
    { category: 'Maternity',  limit: '₦400,000',          includes: ['ANC', 'Delivery', 'Postnatal'], excludes: ['IVF / ART'], waitingPeriod: '6 months' },
    { category: 'Dental',     limit: '₦150,000 / yr',     includes: ['Routine check', 'Restoration', 'Extraction'], excludes: ['Orthodontics', 'Implants'], waitingPeriod: '3 months' },
    { category: 'Optical',    limit: '₦80,000 / yr',      includes: ['Eye test', 'Frames', 'Lenses'], excludes: ['Contact lenses'], waitingPeriod: '3 months' },
    { category: 'Specialist', limit: '₦2,000,000 / yr',   includes: ['Cardiology', 'Orthopaedics', 'Oncology'], excludes: ['Experimental treatment'] },
    { category: 'Emergency',  limit: 'As incurred',        includes: ['A&E visits', 'Ambulance', 'Emergency surgery'], excludes: [] },
  ],
  'Silver': [
    { category: 'Outpatient', limit: 'Unlimited visits', includes: ['GP Consultation', 'Basic diagnostics'], excludes: ['Cosmetic procedures'] },
    { category: 'Inpatient',  limit: '₦3,000,000 / yr',  includes: ['Surgery', 'Physiotherapy'], excludes: ['Pre-existing (yr 1)'], waitingPeriod: '3 months' },
    { category: 'Maternity',  limit: '₦250,000',          includes: ['ANC', 'Delivery'], excludes: ['IVF / ART', 'C-Section elective'], waitingPeriod: '9 months' },
    { category: 'Dental',     limit: '₦80,000 / yr',      includes: ['Routine check', 'Extraction'], excludes: ['Restoration', 'Orthodontics'], waitingPeriod: '6 months' },
    { category: 'Emergency',  limit: 'As incurred',        includes: ['A&E visits', 'Ambulance'], excludes: [] },
  ],
  'Bronze': [
    { category: 'Outpatient', limit: 'Unlimited visits', includes: ['GP Consultation'], excludes: ['Specialist referrals', 'Cosmetic procedures'] },
    { category: 'Inpatient',  limit: '₦1,500,000 / yr',  includes: ['Basic surgery'], excludes: ['Pre-existing (yr 1)'], waitingPeriod: '6 months' },
    { category: 'Emergency',  limit: 'As incurred',        includes: ['A&E visits'], excludes: ['Elective admission'] },
  ],
};

const categoryMeta: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  Outpatient: { Icon: Activity,      color: '#10B981', bg: '#ECFDF5' },
  Inpatient:  { Icon: Building2,     color: '#3B82F6', bg: '#EFF6FF' },
  Maternity:  { Icon: Heart,         color: '#EC4899', bg: '#FDF2F8' },
  Dental:     { Icon: Smile,         color: '#F59E0B', bg: '#FFFBEB' },
  Optical:    { Icon: Eye,           color: '#8B5CF6', bg: '#F5F3FF' },
  Specialist: { Icon: FlaskConical,  color: '#0891B2', bg: '#ECFEFF' },
  Emergency:  { Icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2' },
};

const providers = [
  { name: 'Lagos Island General Hospital', address: 'Lagos Island, Lagos', phone: '01-291-6000', specialties: ['General Practice', 'Specialist'], type: 'Hospital', status: 'Active' },
  { name: 'Reddington Hospital', address: 'Victoria Island, Lagos', phone: '01-470-4940', specialties: ['Cardiology', 'Surgery'], type: 'Hospital', status: 'Active' },
  { name: 'St. Nicholas Hospital', address: 'Lagos Island, Lagos', phone: '01-291-5700', specialties: ['Paediatrics', 'Obs/Gynae'], type: 'Hospital', status: 'Active' },
  { name: 'National Hospital Abuja', address: 'CBD, Abuja', phone: '09-523-4600', specialties: ['Multi-specialty'], type: 'Hospital', status: 'Active' },
  { name: 'Apex Dental Clinic', address: 'Ikeja, Lagos', phone: '01-804-0012', specialties: ['Dentistry'], type: 'Dental', status: 'Active' },
  { name: 'Clear Vision Eye Centre', address: 'Lekki Phase 1, Lagos', phone: '01-734-5500', specialties: ['Ophthalmology'], type: 'Optical', status: 'Suspended' },
  { name: 'MedPlus Diagnostic Centre', address: 'Surulere, Lagos', phone: '01-555-2200', specialties: ['Diagnostics', 'Imaging'], type: 'Diagnostic', status: 'Active' },
  { name: 'Ultima Pharmacy', address: 'VI, Lagos', phone: '01-461-3300', specialties: ['Pharmacy'], type: 'Pharmacy', status: 'Active' },
];

export default function BenefitsPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'providers'>('plans');
  const [activePlan, setActivePlan] = useState<Plan>('Gold Plus');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredProviders = providers.filter((p) => {
    const q = search.toLowerCase();
    return (!q || p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
      && (!typeFilter || p.type === typeFilter);
  });

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="Benefits" subtitle="Plans · Provider Network" />
      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* Main tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 4, background: '#fff', borderRadius: 14, padding: 4, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {(['plans', 'providers'] as const).map((tab) => (
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
                {tab === 'plans' ? 'Benefit Plans' : 'Provider Search'}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'plans' && (
          <>
            {/* Plan selector */}
            <div style={{ display: 'flex', gap: 10 }}>
              {(['Gold Plus', 'Silver', 'Bronze'] as Plan[]).map((plan) => {
                const isActive = activePlan === plan;
                const colors: Record<Plan, { accent: string; bg: string; activeBg: string }> = {
                  'Gold Plus': { accent: '#D97706', bg: '#FFFBEB', activeBg: '#FEF3C7' },
                  'Silver':    { accent: '#475569', bg: '#F1F5F9', activeBg: '#E2E8F0' },
                  'Bronze':    { accent: '#C2410C', bg: '#FFF7ED', activeBg: '#FFEDD5' },
                };
                const c = colors[plan];
                return (
                  <button key={plan} onClick={() => setActivePlan(plan)}
                    style={{
                      padding: '10px 24px',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      border: `1.5px solid ${isActive ? c.accent : '#E5E7F1'}`,
                      background: isActive ? c.activeBg : '#fff',
                      color: isActive ? c.accent : '#6B7280',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: isActive ? `0 2px 8px rgba(0,0,0,0.08)` : 'none',
                    }}>
                    {plan}
                  </button>
                );
              })}
            </div>

            {/* Benefit cards — polished single list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {benefits[activePlan].map((b) => {
                const meta = categoryMeta[b.category] ?? { Icon: FileText, color: '#6B7280', bg: '#F1F5F9' };
                const Icon = meta.Icon;
                const totalItems = b.includes.length + b.excludes.length;
                return (
                  <div key={b.category} style={{ background: '#fff', borderRadius: 20, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    {/* Card header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 28px', borderBottom: '1px solid #F0F1F5' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 24, height: 24, color: meta.color }} strokeWidth={1.75} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E', letterSpacing: '-0.01em' }}>{b.category}</p>
                        <p style={{ fontSize: 12, color: '#9CA3B8', marginTop: 2 }}>{totalItems} benefits covered · Limit: <span style={{ fontWeight: 600, color: '#131C4E' }}>{b.limit}</span></p>
                      </div>
                      {b.waitingPeriod && (
                        <span style={{ fontSize: 11, fontWeight: 600, background: '#FFFBEB', color: '#D97706', padding: '4px 12px', borderRadius: 99, border: '1px solid #FDE68A', flexShrink: 0 }}>
                          {b.waitingPeriod} waiting period
                        </span>
                      )}
                    </div>

                    {/* Includes section */}
                    <div style={{ padding: '0 28px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px', borderLeft: '3px solid #F56B22', paddingLeft: 12, marginLeft: -12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#131C4E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>What&apos;s Covered</span>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#ECFDF5', color: '#059669', padding: '3px 10px', borderRadius: 99 }}>{b.includes.length} COVERED</span>
                      </div>
                      {b.includes.map((inc, i) => (
                        <div key={inc} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F7F8FA' }}>
                          <CheckCircle style={{ width: 16, height: 16, color: '#10B981', flexShrink: 0 }} strokeWidth={2.5} />
                          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{inc}</span>
                        </div>
                      ))}

                      {/* Excludes section */}
                      {b.excludes.length > 0 && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0 12px', borderTop: '1px solid #F0F1F5', marginTop: 4, borderLeft: '3px solid #EF4444', paddingLeft: 12, marginLeft: -12 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#131C4E', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Not Covered</span>
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF2F2', color: '#DC2626', padding: '3px 10px', borderRadius: 99 }}>{b.excludes.length} EXCLUDED</span>
                          </div>
                          {b.excludes.map((exc, i) => (
                            <div key={exc} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F7F8FA' }}>
                              <XCircle style={{ width: 16, height: 16, color: '#EF4444', flexShrink: 0 }} strokeWidth={2.5} />
                              <span style={{ fontSize: 13, color: '#9CA3B8', fontWeight: 500 }}>{exc}</span>
                            </div>
                          ))}
                        </>
                      )}
                      <div style={{ height: 8 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {activeTab === 'providers' && (
          <>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 520 }}>
                  <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#C4C9D9' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search provider name or location..."
                    style={{ width: '100%', height: 42, paddingLeft: 42, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ height: 42, padding: '0 32px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                  <option value="">All Types</option>
                  <option>Hospital</option><option>Dental</option><option>Optical</option><option>Diagnostic</option><option>Pharmacy</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredProviders.map((p) => (
                <div key={p.name} style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDEEF2', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin style={{ width: 20, height: 20, color: '#F56B22' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>{p.name}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, flexShrink: 0, background: p.status === 'Active' ? '#ECFDF5' : '#FEF2F2', color: p.status === 'Active' ? '#059669' : '#DC2626' }}>{p.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9CA3B8' }}>
                        <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />{p.address}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#F56B22', fontWeight: 500 }}>
                        <Phone style={{ width: 12, height: 12, flexShrink: 0 }} />{p.phone}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0, maxWidth: 280, justifyContent: 'flex-end' }}>
                    {p.specialties.map((s) => (
                      <span key={s} style={{ fontSize: 10, fontWeight: 600, background: '#EEF2FF', color: '#3730A3', padding: '3px 8px', borderRadius: 6 }}>{s}</span>
                    ))}
                    <span style={{ fontSize: 10, fontWeight: 600, background: '#F1F2F8', color: '#6B7280', padding: '3px 8px', borderRadius: 6 }}>{p.type}</span>
                  </div>
                  <button style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', fontSize: 12, fontWeight: 600, color: '#F56B22', border: '1.5px solid #FFD8C0', borderRadius: 10, background: '#FFF5EF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <MapPin style={{ width: 13, height: 13 }} /> Directions
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
