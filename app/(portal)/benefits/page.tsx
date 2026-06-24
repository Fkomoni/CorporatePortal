'use client';

import { useState } from 'react';
import { Search, MapPin, Phone, CheckCircle, XCircle } from 'lucide-react';
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

const categoryIcons: Record<string, string> = {
  Outpatient: '🏥', Inpatient: '🛍️', Maternity: '👶', Dental: '🦷', Optical: '👁️', Specialist: '🔬', Emergency: '🚨',
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
    <div className="flex flex-col min-h-full bg-[#FAFBFC]">
      <TopBar title="Benefits" subtitle="Plans · Provider Network" />
      <div className="p-6 flex flex-col gap-5">
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#F0F1F5] shadow-sm w-fit">
          {(['plans', 'providers'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all ${activeTab === tab ? 'text-white shadow-sm' : 'text-[#6B7280] hover:text-[#131C4E]'}`}
              style={activeTab === tab ? { background: '#131C4E' } : {}}>
              {tab === 'plans' ? 'Benefit Plans' : 'Provider Search'}
            </button>
          ))}
        </div>
        {activeTab === 'plans' && (
          <>
            <div className="flex gap-2">
              {(['Gold Plus', 'Silver', 'Bronze'] as Plan[]).map((plan) => (
                <button key={plan} onClick={() => setActivePlan(plan)}
                  className={`px-4 py-2 rounded-xl text-[12px] font-semibold transition-all border ${activePlan === plan ? 'border-[#F56B22] text-[#F56B22] bg-[#FFF1E6]' : 'border-[#E5E7F1] text-[#6B7280] bg-white hover:border-[#9CA3B8]'}`}>
                  {plan}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {benefits[activePlan].map((b) => (
                <div key={b.category} className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[20px]">{categoryIcons[b.category] ?? '📋'}</span>
                      <span className="text-[14px] font-bold text-[#131C4E]">{b.category}</span>
                    </div>
                    {b.waitingPeriod && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{b.waitingPeriod} wait</span>}
                  </div>
                  <div className="text-[20px] font-extrabold text-[#131C4E] mb-1 tracking-tight">{b.limit}</div>
                  <p className="text-[10px] font-semibold text-[#9CA3B8] uppercase tracking-widest mb-2">Limit</p>
                  <div className="space-y-1 mb-3">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1">Includes</p>
                    {b.includes.map((inc) => (<div key={inc} className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" /><span className="text-[12px] text-[#3A4382]">{inc}</span></div>))}
                  </div>
                  {b.excludes.length > 0 && (
                    <div className="space-y-1 pt-3 border-t border-[#F7F8FA]">
                      <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-1">Excludes</p>
                      {b.excludes.map((exc) => (<div key={exc} className="flex items-center gap-1.5"><XCircle className="w-3 h-3 text-red-400 flex-shrink-0" /><span className="text-[12px] text-[#9CA3B8]">{exc}</span></div>))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
        {activeTab === 'providers' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#F0F1F5]">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3B8]" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search provider name or location..."
                    className="w-full h-9 pl-9 pr-3 text-[13px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] placeholder:text-[#9CA3B8] outline-none focus:border-[#F56B22] focus:bg-white transition-colors" />
                </div>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 px-3 text-[12px] border border-[#E5E7F1] rounded-xl bg-[#F7F8FA] text-[#131C4E] outline-none">
                  <option value="">All Types</option>
                  <option>Hospital</option><option>Dental</option><option>Optical</option><option>Diagnostic</option><option>Pharmacy</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {filteredProviders.map((p) => (
                <div key={p.name} className="bg-white rounded-2xl p-5 shadow-sm border border-[#F0F1F5]">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[14px] font-bold text-[#131C4E] leading-snug flex-1 pr-2">{p.name}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={p.status === 'Active' ? { background: '#ECFDF5', color: '#059669' } : { background: '#FEF2F2', color: '#DC2626' }}>{p.status}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280] mb-1.5"><MapPin className="w-3 h-3 text-[#9CA3B8] flex-shrink-0" />{p.address}</div>
                  <div className="flex items-center gap-1.5 text-[12px] text-[#6B7280] mb-3"><Phone className="w-3 h-3 text-[#9CA3B8] flex-shrink-0" />{p.phone}</div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.specialties.map((s) => (<span key={s} className="text-[10px] font-semibold bg-[#EEF2FF] text-[#3A4382] px-2 py-0.5 rounded-full">{s}</span>))}
                    <span className="text-[10px] font-semibold bg-[#F1F2F8] text-[#6B7280] px-2 py-0.5 rounded-full">{p.type}</span>
                  </div>
                  <button className="text-[12px] font-semibold text-[#F56B22]">Get Directions →</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
