'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PeopleVis, DEFAULTS, getVis } from '@/lib/module-visibility';
import {
  Search, Upload, ArrowDownToLine, Plus, FileText,
  CreditCard, X, Phone, Mail, MapPin, Calendar,
  ShieldCheck, Users, Activity, AlertCircle, Send, Link2, UserPlus, Camera,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import type { Member } from '@/lib/types';
import type { MemberStats } from '@/app/api/hr/members/route';
import type { PolicyScheme } from '@/app/api/hr/benefits/schemes/route';
import { useToast } from '@/components/ui/Toast';
import { exportToXls } from '@/lib/exportXls';


const planColors: Record<string, { bg: string; text: string }> = {
  'Plus Plan':   { bg: '#FFF7ED', text: '#C2410C' },
  'Pro Plan':    { bg: '#F1F5F9', text: '#475569' },
  'Max Plan':    { bg: '#FFFBEB', text: '#D97706' },
  'Promax Plan': { bg: '#EFF6FF', text: '#2563EB' },
  'Magnum Plan': { bg: '#F5F3FF', text: '#6D28D9' },
};

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  'Active':     { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  'Pending':    { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  'Terminated': { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

const SUMMARY_CARD_DEFS = [
  { label: 'Active Members',    key: 'activeCount'  as const, sub: 'Total covered lives', color: '#131C4E', bg: '#EEF2FF', Icon: Users       },
  { label: 'New This Month',    key: 'newThisMonth' as const, sub: 'Enrolments this month', color: '#10B981', bg: '#ECFDF5', Icon: Activity    },
  { label: 'Pending Additions', key: 'pendingCount' as const, sub: 'Awaiting activation', color: '#D97706', bg: '#FFFBEB', Icon: ShieldCheck },
];

const avatarGradients = [
  'linear-gradient(135deg,#F56B22,#FFB54B)', 'linear-gradient(135deg,#131C4E,#3A4382)',
  'linear-gradient(135deg,#10B981,#059669)', 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
  'linear-gradient(135deg,#8B5CF6,#6D28D9)', 'linear-gradient(135deg,#EC4899,#DB2777)',
  'linear-gradient(135deg,#14B8A6,#0D9488)', 'linear-gradient(135deg,#F59E0B,#D97706)',
];


const categoryIconColors: Record<string, { bg: string; color: string }> = {
  'Outpatient': { bg: '#FFF3E8', color: '#F56B22' },
  'Dental':     { bg: '#FFF7ED', color: '#C2410C' },
  'Inpatient':  { bg: '#EFF6FF', color: '#2563EB' },
  'Optical':    { bg: '#F5F3FF', color: '#7C3AED' },
  'Maternity':  { bg: '#FFF1F2', color: '#BE123C' },
};

/* ── Custom checkbox ─────────────────────────────────────────────────── */
function Checkbox({
  checked, indeterminate = false, onChange, onClick, title,
}: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
  onClick?: (e: React.MouseEvent) => void; title?: string;
}) {
  const active = checked || indeterminate;
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      title={title}
      onClick={(e) => { onClick?.(e); onChange(); }}
      style={{
        width: 18, height: 18, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
        border: active ? 'none' : '2px solid #D1D5DB',
        background: active ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        boxShadow: active ? '0 2px 6px rgba(245,107,34,0.28)' : 'inset 0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {indeterminate && !checked
        ? <svg width="8" height="2" viewBox="0 0 8 2" fill="none"><path d="M1 1H7" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        : checked
          ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : null}
    </div>
  );
}

/* ── Passport photo uploader ─────────────────────────────────────────── */
function PhotoUpload({ size = 88, compact = false }: { size?: number; compact?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [hover, setHover]     = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: 'center', gap: compact ? 14 : 8 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: size, height: size, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
          border: `2px ${preview ? 'solid #E5E7F1' : 'dashed #D1D5DB'}`,
          background: preview ? 'transparent' : '#F7F8FC',
          overflow: 'hidden', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}
      >
        {preview
          ? <img src={preview} alt="passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Camera style={{ width: size * 0.28, height: size * 0.28, color: '#C4C9D9' }} />
        }
        {hover && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Camera style={{ width: 17, height: 17, color: '#fff' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>{preview ? 'CHANGE' : 'UPLOAD'}</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <div style={{ textAlign: compact ? 'left' : 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3B8' }}>Passport Photo</p>
        <p style={{ fontSize: 10, color: '#C4C9D9', marginTop: 1 }}>Optional</p>
        {preview && (
          <button onClick={(e) => { e.stopPropagation(); setPreview(null); }}
            style={{ fontSize: 10, fontWeight: 600, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 3, display: 'block' }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

interface RelationshipOption { text: string; value: string; }
interface ListItem { text: string; value: string; }


/* ── Add Member Modal ────────────────────────────────────────────────── */
function AddMemberModal({ initialMode, onClose, relationshipOptions, schemes, principals }: { initialMode?: 'individual' | 'bulk'; onClose: () => void; relationshipOptions: RelationshipOption[]; schemes: PolicyScheme[]; principals: Member[] }) {
  const [mode, setMode]             = useState<'individual' | 'bulk'>(initialMode ?? 'individual');
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [memberType, setMemberType] = useState<'new' | 'existing'>('new');
  const [actionType, setActionType] = useState<'link' | 'form'>('link');
  const [linkScope, setLinkScope]   = useState<'self' | 'self-dependent'>('self');
  const [bulkAction, setBulkAction] = useState<'csv' | 'invite'>('csv');
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');
  // Bulk CSV state
  interface BulkRow { idx: number; firstName: string; surname: string; otherNames: string; dob: string; gender: string; email: string; mobile: string; employeeCode: string; errors: string[]; }
  const [bulkStep, setBulkStep]       = useState<'upload' | 'review' | 'done'>('upload');
  const [bulkRows, setBulkRows]       = useState<BulkRow[]>([]);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<Map<number, { status: 'pending' | 'ok' | 'error'; msg?: string }>>(new Map());
  const [bulkSchemeId, setBulkSchemeId] = useState('');
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const [enrollResult, setEnrollResult] = useState<{ name: string; memberId: string; cifNumber?: string | null; isNewWithDeps?: boolean; schemeId?: string; schemeName?: string; empCode?: string } | null>(null);
  // Dep state for "new staff + dependants" success screen
  const [enrolledDeps, setEnrolledDeps] = useState<Array<{ name: string; memberId: string }>>([]);
  const [depFormOpen, setDepFormOpen]   = useState(false);
  const [depFN, setDepFN]               = useState('');
  const [depLN, setDepLN]               = useState('');
  const [depDob2, setDepDob2]           = useState('');
  const [depSex, setDepSex]             = useState('');
  const [depRel, setDepRel]             = useState('');
  const [depSt, setDepSt]               = useState('');
  const [depMob, setDepMob]             = useState('');
  const [depEm, setDepEm]               = useState('');
  const [depErr, setDepErr]             = useState('');
  const [depSub, setDepSub]             = useState(false);
  const { toast } = useToast();

  // List values
  const [genders, setGenders]       = useState<ListItem[]>([]);
  const [maritalOpts, setMarital]   = useState<ListItem[]>([]);
  const [stateOpts, setStates]      = useState<ListItem[]>([]);
  const [regionOpts, setRegions]    = useState<ListItem[]>([]);
  const [townOpts, setTowns]        = useState<ListItem[]>([]);
  const [townsLoading, setTownsLoading] = useState(false);
  useEffect(() => {
    fetch('/api/hr/list-values').then((r) => r.json()).then((d) => {
      if (d.genders)        setGenders(d.genders);
      if (d.maritalStatuses) setMarital(d.maritalStatuses);
      if (d.states)         setStates(d.states);
      if (d.regions?.length) setRegions(d.regions);
    }).catch(() => {});
  }, []);

  // Link form fields
  const [linkEmail, setLinkEmail]     = useState('');
  const [linkEmpCode, setLinkEmpCode] = useState('');
  const [linkMaxDeps, setLinkMaxDeps] = useState(1);
  const [generatedUrl, setGeneratedUrl] = useState('');

  // Principal picker (for "Existing staff's dependent" flow)
  const [principalSearch, setPrincipalSearch] = useState('');
  const [selectedPrincipal, setSelectedPrincipal] = useState<Member | null>(null);
  const [principalProfile, setPrincipalProfile] = useState<{ cifNumber: string; schemeId: string; schemeName: string; groupId: string; employeeCode: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [relId, setRelId] = useState('');

  // Direct form fields
  const [firstName, setFirstName]   = useState('');
  const [surname, setSurname]       = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [empCode, setEmpCode]       = useState('');
  const [email, setEmail]           = useState('');
  const [mobile, setMobile]         = useState('');
  const [mobile2, setMobile2]       = useState('');
  const [dob, setDob]               = useState('');
  const [sexId, setSexId]           = useState('');
  const [maritalStatus, setMarStatus] = useState('');
  const [stateId, setStateId]       = useState('');
  const [regionId, setRegionId]     = useState('');
  const [townId, setTownId]         = useState('');
  const [address, setAddress]       = useState('');
  const [preExisting, setPreExist]  = useState('');
  const [photoBase64, setPhotoB64]  = useState('');
  const [photoType, setPhotoType]   = useState('');
  const photoRef = useRef<HTMLInputElement>(null);

  // ── Bulk helpers ─────────────────────────────────────────────────────────
  function parseBulkFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const XLSX = await import('xlsx');
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb   = XLSX.read(data, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const rows: BulkRow[] = raw.map((r, idx) => {
        const get = (...keys: string[]) => {
          for (const k of keys) { const v = r[k]; if (v != null && String(v).trim()) return String(v).trim(); }
          return '';
        };
        const firstName    = get('First Name','FirstName','first_name','firstname');
        const surname      = get('Last Name','LastName','Surname','surname','last_name');
        const otherNames   = get('Other Names','OtherNames','other_names');
        const dob          = get('Date of Birth','DOB','DateOfBirth','date_of_birth','dob');
        const gender       = get('Gender','Sex','gender','sex');
        const email        = get('Email','email','Email Address');
        const mobile       = get('Mobile','Phone','mobile','phone','Mobile Number');
        const employeeCode = get('Employee Code','Staff ID','EmployeeCode','employee_code','staff_id','StaffID');
        const errors: string[] = [];
        if (!firstName)    errors.push('First Name required');
        if (!surname)      errors.push('Last Name required');
        if (!dob)          errors.push('Date of Birth required');
        if (!gender)       errors.push('Gender required');
        if (!email)        errors.push('Email required');
        if (!mobile)       errors.push('Mobile required');
        if (!employeeCode) errors.push('Employee Code required');
        if (dob && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$|^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push('DOB must be DD/MM/YYYY');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email');
        return { idx, firstName, surname, otherNames, dob, gender, email, mobile, employeeCode, errors };
      });
      setBulkRows(rows);
      setBulkSelected(new Set(rows.filter(r => r.errors.length === 0).map(r => r.idx)));
      setBulkStep('review');
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadBulkTemplate() {
    import('xlsx').then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['First Name','Last Name','Other Names','Date of Birth','Gender','Email','Mobile','Employee Code'],
        ['John','Doe','','01/01/1990','Male','john.doe@company.com','08012345678','EMP001'],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Census');
      XLSX.writeFile(wb, 'bulk-enrolment-template.xlsx');
    });
  }

  async function submitBulkRows() {
    if (!bulkSchemeId) { toast('Please select a plan/scheme first.', 'error'); return; }
    const scheme = schemes.find(s => s.schemeId === bulkSchemeId);
    if (!scheme) { toast('Invalid scheme selected.', 'error'); return; }
    const toSubmit = bulkRows.filter(r => bulkSelected.has(r.idx) && r.errors.length === 0);
    if (!toSubmit.length) { toast('No valid rows selected.', 'error'); return; }
    const initial = new Map(toSubmit.map(r => [r.idx, { status: 'pending' as const }]));
    setBulkProgress(initial);
    setBulkStep('done');
    for (const row of toSubmit) {
      // Normalise DOB to YYYY-MM-DD
      let dob = row.dob;
      const dmy = dob.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) dob = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
      const sexId = /^f/i.test(row.gender) ? '2' : '1';
      try {
        const res = await fetch('/api/hr/members/add', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schemeId: bulkSchemeId, schemeName: scheme.schemeName, firstName: row.firstName, surname: row.surname, otherNames: row.otherNames, dateOfBirth: dob, sexId, email: row.email, mobile: row.mobile, postalTownId: '1', employeeCode: row.employeeCode }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setBulkProgress(prev => new Map(prev).set(row.idx, { status: 'error', msg: data.error ?? 'Failed' }));
        } else {
          setBulkProgress(prev => new Map(prev).set(row.idx, { status: 'ok', msg: data.enrolleeId ?? '' }));
        }
      } catch {
        setBulkProgress(prev => new Map(prev).set(row.idx, { status: 'error', msg: 'Network error' }));
      }
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, b64] = result.split(',');
      const mime = header.match(/data:([^;]+);/)?.[1] ?? file.type;
      setPhotoB64(b64 ?? '');
      setPhotoType(mime);
    };
    reader.readAsDataURL(file);
  }

  const selectedScheme = schemes.find((s) => s.schemeId === selectedSchemeId) ?? schemes[0];

  // Map an actual Prognosis scheme name to the UI plan label (mirrors server-side mapPlan)
  function mapPlanName(raw: string): string {
    const s = raw.toLowerCase();
    if (s.includes('magnum') || s.includes('blackcard') || s.includes('black card')) return 'Magnum Plan';
    if (s.includes('promax') || s.includes('pro max')) return 'Promax Plan';
    if (s.includes('max')) return 'Max Plan';
    if (s.includes('pro')) return 'Pro Plan';
    return 'Plus Plan';
  }

  function resolveScheme(p: Member) {
    // 1. Exact schemeId match (most reliable)
    if (p.schemeId) {
      const byId = schemes.find((s) => s.schemeId === p.schemeId);
      if (byId) return byId;
    }
    // 2. Fuzzy-match scheme name → UI plan label
    const byName = schemes.find((s) => mapPlanName(s.schemeName) === p.plan);
    if (byName) return byName;
    // 3. If company only has one scheme, use it
    if (schemes.length === 1) return schemes[0];
    return null;
  }

  async function selectPrincipal(p: Member) {
    setSelectedPrincipal(p);
    setPrincipalProfile(null);
    setEmpCode(p.employeeId);
    setLinkEmpCode(p.employeeId);
    setLinkEmail(p.email);
    // Pre-fill scheme from local data while the API loads
    const localScheme = resolveScheme(p);
    if (localScheme) setSelectedSchemeId(localScheme.schemeId);
    setPrincipalSearch('');
    // Fetch full profile from Prognosis to get exact CIF, schemeId, schemeName
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/hr/members/enrollee-profile?enrolleeId=${encodeURIComponent(p.employeeId)}`);
      const data = await res.json();
      if (res.ok && data.cifNumber) {
        setPrincipalProfile(data);
        if (data.schemeId) setSelectedSchemeId(data.schemeId);
        if (data.employeeCode) setEmpCode(data.employeeCode);
      }
    } catch { /* use local data as fallback */ }
    finally { setProfileLoading(false); }
  }

  function handleRegionChange(rid: string) {
    setRegionId(rid);
    setTownId('');
    setTowns([]);
    if (!rid) return;
    setTownsLoading(true);
    fetch(`/api/hr/list-values?type=towns&regionId=${rid}`)
      .then((r) => r.json())
      .then((d) => { if (d.towns?.length) setTowns(d.towns); })
      .catch(() => {})
      .finally(() => setTownsLoading(false));
  }

  function copyText(text: string, label = 'Copied!') {
    // Always do the textarea trick first (works inside modals/dialogs where
    // navigator.clipboard requires a top-level browsing context focus).
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); } catch { /* ignore */ }
    document.body.removeChild(ta);
    // Also try the modern API in case execCommand is deprecated in the browser.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => { /* already copied via execCommand */ });
    }
    toast(label, 'success');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 14px', fontSize: 13,
    border: '1.5px solid #E5E7F1', borderRadius: 12, background: '#FAFBFC',
    color: '#131C4E', outline: 'none', boxSizing: 'border-box',
  };
  const focusOn  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = '#F56B22'; };
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = '#E5E7F1'; };

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      if (mode === 'individual' && actionType === 'link') {
        if (!linkEmail || !linkEmpCode) {
          setFormError('Staff email and employee code are required.'); return;
        }
        if (memberType === 'existing' && !selectedPrincipal) {
          setFormError('Please search and select the staff member this dependent link is for.'); return;
        }
        const isDepLink = memberType === 'existing';
        const depScheme = isDepLink && selectedPrincipal
          ? resolveScheme(selectedPrincipal)
          : null;
        if (isDepLink && selectedPrincipal && !depScheme && !selectedPrincipal.schemeId) {
          setFormError(`Cannot find scheme matching "${selectedPrincipal.plan}". Please refresh the page and try again.`); return;
        }
        const res = await fetch('/api/hr/members/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: linkEmail,
            employeeCode: isDepLink && selectedPrincipal ? selectedPrincipal.employeeId : linkEmpCode,
            schemeId: isDepLink && selectedPrincipal ? (depScheme?.schemeId ?? selectedPrincipal.schemeId ?? selectedSchemeId) : selectedSchemeId,
            schemeName: isDepLink && selectedPrincipal ? (depScheme?.schemeName ?? selectedPrincipal.plan) : (selectedScheme?.schemeName ?? ''),
            scope: linkScope,
            ...(isDepLink && selectedPrincipal ? {
              inviteType: 'dependent',
              parentCif: String(selectedPrincipal.cifNumber ?? principalProfile?.cifNumber ?? ''),
              maxDependents: linkMaxDeps,
            } : linkScope === 'self-dependent' ? {
              maxDependents: linkMaxDeps,
            } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setFormError(data.error ?? 'Failed to generate link'); return; }
        setGeneratedUrl(data.url);
        if (data.emailSent) {
          toast(`Enrolment link sent to ${linkEmail}!`, 'success');
        } else {
          toast('Link generated — email could not be sent, copy and share manually.', 'success');
        }
        return;
      }

      if (mode === 'individual' && actionType === 'form' && memberType === 'existing') {
        // Adding a dependent to an existing principal via HR direct form
        if (!selectedPrincipal) { setFormError('Please search and select the staff member this dependent belongs to.'); return; }
        if (!firstName || !surname || !dob || !sexId || !relId) {
          setFormError('Please fill all required fields: First Name, Surname, Date of Birth, Gender and Relationship.'); return;
        }
        // Use live profile from Prognosis API; fall back to local member data
        const profile = principalProfile;
        const resolvedCif        = profile?.cifNumber || selectedPrincipal.cifNumber || '';
        const resolvedSchemeId   = profile?.schemeId  || selectedPrincipal.schemeId  || resolveScheme(selectedPrincipal)?.schemeId  || '';
        const resolvedSchemeName = profile?.schemeName || resolveScheme(selectedPrincipal)?.schemeName || selectedPrincipal.plan;
        const resolvedEmpCode    = profile?.employeeCode || selectedPrincipal.employeeId;
        if (!resolvedCif) { setFormError('Could not find principal CIF number. Please try selecting them again.'); return; }
        if (!resolvedSchemeId) { setFormError(`Cannot resolve scheme for this principal. Please contact support.`); return; }
        const res = await fetch('/api/hr/members/add-dependents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentCif: Number(resolvedCif) || resolvedCif,
            schemeId: resolvedSchemeId, schemeName: resolvedSchemeName,
            employeeCode: resolvedEmpCode,
            dependents: [{
              firstName, surname, otherNames, dateOfBirth: dob,
              sexId, maritalStatus, email, mobile,
              regionId, postalTownId: townId || stateId, relationshipId: relId,
              preExistingCondition: preExisting || 'None',
              enrolleePicture: photoBase64, enrolleePictureType: photoType,
            }],
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setFormError(data.error ?? 'Failed to add dependent'); return; }
        const enrolled = data.enrolled?.[0];
        const memberId = enrolled?.enrolleeId || enrolled?.membershipNo || '';
        // Fire email to dependent (non-blocking)
        if (email && memberId) {
          fetch('/api/hr/members/send-enrolee-id', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, enroleeId: memberId, memberName: `${firstName} ${surname}`, schemeName: selectedPrincipal?.plan }),
          }).catch(() => {});
        }
        setEnrollResult({ name: `${firstName} ${surname}`, memberId });
        return;
      }

      if (mode === 'individual' && actionType === 'form') {
        if (!selectedSchemeId || !firstName || !surname || !empCode || !email || !mobile || !dob || !sexId || !stateId) {
          setFormError('Please fill all required fields: Plan, First Name, Surname, Employee Code, Email, Mobile, Date of Birth, Gender and State.'); return;
        }
        const res = await fetch('/api/hr/members/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schemeId: selectedSchemeId, schemeName: selectedScheme?.schemeName ?? '',
            firstName, surname, otherNames, dateOfBirth: dob,
            sexId, maritalStatus, email, mobile, mobile2,
            postalTownId: stateId, address,
            employeeCode: empCode, preExistingCondition: preExisting || 'None',
            enrolleePicture: photoBase64, enrolleePictureType: photoType,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setFormError(data.error ?? 'Failed to add member'); return; }
        const memberId = data.enrolleeId || data.membershipNo || data.fullEnrolleeId || '';
        // Fire email to new member (non-blocking)
        if (email && memberId) {
          fetch('/api/hr/members/send-enrolee-id', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, enroleeId: memberId, memberName: `${firstName} ${surname}`, schemeName: selectedScheme?.schemeName }),
          }).catch(() => {});
        }
        setEnrollResult({ name: `${firstName} ${surname}`, memberId, cifNumber: data.cifNumber ?? null, isNewWithDeps: linkScope === 'self-dependent', schemeId: selectedSchemeId, schemeName: selectedScheme?.schemeName ?? '', empCode });
        return;
      }

      if (mode === 'bulk' && bulkAction === 'csv') {
        await submitBulkRows();
        return;
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = submitting ? 'Please wait…'
    : mode === 'individual' && actionType === 'link' ? 'Generate Link'
    : mode === 'individual' ? 'Add Member'
    : bulkStep === 'review' ? `Enrol ${bulkSelected.size} Member${bulkSelected.size !== 1 ? 's' : ''}`
    : bulkStep === 'done' ? 'Close'
    : 'Upload & Enrol';

  // ── Add-dependent handler for "new staff + dependants" success screen ───
  async function handleAddDep() {
    if (depSub || !enrollResult?.cifNumber) return;
    setDepErr('');
    if (!depFN || !depLN || !depDob2 || !depSex || !depRel || !depSt) {
      setDepErr('Please fill all required fields: First Name, Last Name, Date of Birth, Gender, Relationship and State.'); return;
    }
    setDepSub(true);
    try {
      const res = await fetch('/api/hr/members/add-dependents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentCif: Number(enrollResult.cifNumber) || enrollResult.cifNumber,
          schemeId: enrollResult.schemeId, schemeName: enrollResult.schemeName,
          employeeCode: enrollResult.empCode,
          dependents: [{ firstName: depFN, surname: depLN, dateOfBirth: depDob2, sexId: depSex, relationshipId: depRel, postalTownId: depSt, mobile: depMob, email: depEm }],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setDepErr(data.error ?? 'Failed to add dependent'); return; }
      const enrolled2 = data.enrolled?.[0];
      const depMemberId = enrolled2?.enrolleeId || enrolled2?.membershipNo || '';
      if (depEm && depMemberId) {
        fetch('/api/hr/members/send-enrolee-id', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: depEm, enroleeId: depMemberId, memberName: `${depFN} ${depLN}`, schemeName: enrollResult.schemeName }),
        }).catch(() => {});
      }
      setEnrolledDeps((prev) => [...prev, { name: `${depFN} ${depLN}`, memberId: depMemberId }]);
      setDepFN(''); setDepLN(''); setDepDob2(''); setDepSex(''); setDepRel(''); setDepSt(''); setDepMob(''); setDepEm('');
      setDepFormOpen(false);
      toast(`${depFN} ${depLN} added as dependent!`, 'success');
    } catch (err) {
      setDepErr(err instanceof Error ? err.message : 'Failed to add dependent');
    } finally {
      setDepSub(false);
    }
  }

  // ── Enrolment success screen ──────────────────────────────────────────
  if (enrollResult) {
    const { name, memberId, isNewWithDeps } = enrollResult;
    const depInputStyle: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' };
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: isNewWithDeps ? 580 : 520, maxHeight: '90vh',
          background: '#fff', borderRadius: 28, zIndex: 50,
          boxShadow: '0 32px 100px rgba(0,0,0,0.22)', overflowY: 'auto',
          textAlign: 'center',
        }}>
          {/* Big green success banner */}
          <div style={{ background: 'linear-gradient(135deg,#059669,#10B981)', padding: '44px 36px 36px' }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '3px solid rgba(255,255,255,0.4)' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M10 24L19 33L38 14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>Enrolment Successful!</p>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{name} has been added to the plan.</p>
          </div>

          {/* Member ID section */}
          <div style={{ padding: '32px 36px', overflowY: 'auto' }}>
            {memberId ? (
              <div style={{ background: '#F0FDF4', border: '2px solid #6EE7B7', borderRadius: 18, padding: '24px 28px', marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Enrolee ID</p>
                <p style={{ fontSize: 36, fontWeight: 900, color: '#065F46', fontFamily: 'monospace', letterSpacing: '0.06em', marginBottom: 16 }}>{memberId}</p>
                <button
                  onClick={() => copyText(memberId, 'Enrolee ID copied!')}
                  style={{ height: 40, padding: '0 24px', fontSize: 13, fontWeight: 700, color: '#059669', background: '#fff', border: '2px solid #6EE7B7', borderRadius: 10, cursor: 'pointer' }}>
                  Copy Enrolee ID
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 13, color: '#9CA3B8' }}>The member has been enrolled. Their enrolee ID will be generated by Leadway Health shortly.</p>
              </div>
            )}

            {/* ── "New staff + dependants" dep section ── */}
            {isNewWithDeps && (
              <div style={{ textAlign: 'left', marginBottom: 28 }}>
                <div style={{ height: 1, background: '#F0F1F5', marginBottom: 20 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 12 }}>Add Dependants</p>

                {/* Enrolled deps list */}
                {enrolledDeps.length > 0 && (
                  <div style={{ background: '#F7FFFE', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
                    {enrolledDeps.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: i > 0 ? '8px 0 0' : 0 }}>
                        <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{d.name}</span>
                        <span style={{ fontSize: 12, color: '#059669', fontFamily: 'monospace', fontWeight: 700 }}>{d.memberId || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dep error */}
                {depErr && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#DC2626' }}>{depErr}</div>
                )}

                {/* Dep form */}
                {depFormOpen ? (
                  <div style={{ border: '1.5px solid #E5E7F1', borderRadius: 16, padding: '18px 20px', background: '#FAFBFF' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      {([
                        { label: 'First Name *', value: depFN, set: setDepFN, ph: '' },
                        { label: 'Last Name *',  value: depLN, set: setDepLN, ph: '' },
                        { label: 'Email',        value: depEm, set: setDepEm, ph: 'optional', type: 'email' },
                        { label: 'Mobile',       value: depMob, set: setDepMob, ph: 'optional', type: 'tel' },
                      ] as Array<{label:string;value:string;set:(v:string)=>void;ph:string;type?:string}>).map((f) => (
                        <div key={f.label}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{f.label}</p>
                          <input type={f.type ?? 'text'} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} style={depInputStyle} />
                        </div>
                      ))}
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Date of Birth *</p>
                        <input type="date" value={depDob2} onChange={(e) => setDepDob2(e.target.value)} style={depInputStyle} />
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Gender *</p>
                        <select value={depSex} onChange={(e) => setDepSex(e.target.value)} style={{ ...depInputStyle, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select</option>
                          {genders.map((g) => <option key={g.value} value={g.value}>{g.text}</option>)}
                        </select>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Relationship *</p>
                        <select value={depRel} onChange={(e) => setDepRel(e.target.value)} style={{ ...depInputStyle, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select</option>
                          {relationshipOptions.filter((r) => r.text !== 'Main member').map((r) => <option key={r.value} value={r.value}>{r.text}</option>)}
                        </select>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>State *</p>
                        <select value={depSt} onChange={(e) => setDepSt(e.target.value)} style={{ ...depInputStyle, appearance: 'none', cursor: 'pointer' }}>
                          <option value="">Select</option>
                          {stateOpts.map((s) => <option key={s.value} value={s.value}>{s.text}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button onClick={() => { setDepFormOpen(false); setDepErr(''); }}
                        style={{ flex: 1, height: 38, fontSize: 13, fontWeight: 600, color: '#9CA3B8', background: '#F7F8FA', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={handleAddDep} disabled={depSub}
                        style={{ flex: 2, height: 38, fontSize: 13, fontWeight: 700, color: '#fff', background: depSub ? '#E5E7F1' : 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10, cursor: depSub ? 'not-allowed' : 'pointer' }}>
                        {depSub ? 'Adding…' : 'Add Dependant'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setDepFormOpen(true)}
                    style={{ width: '100%', height: 42, fontSize: 13, fontWeight: 700, color: '#10B981', border: '1.5px dashed #BBF7D0', borderRadius: 12, background: '#F0FDF4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <UserPlus style={{ width: 14, height: 14 }} /> + Add a Dependant
                  </button>
                )}
              </div>
            )}

            <button onClick={onClose}
              style={{ width: '100%', height: 52, fontSize: 16, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#059669,#10B981)', border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', letterSpacing: '0.01em' }}>
              ✓ Done
            </button>
          </div>
        </div>
      </>
    );
  }

  // Step labels for individual mode wizard
  const STEP_LABELS = ['How to Enrol', 'Enrolment Type', 'Member Details'];

  // Step 1 choice handler
  function chooseMethod(method: 'link' | 'form') {
    setActionType(method);
    setStep(2);
  }

  // Step 2 choice handler — maps enrolment type to internal state
  function chooseType(type: 'principal' | 'dependent' | 'new-with-deps') {
    if (type === 'principal') {
      setMemberType('new');
      setLinkScope('self');
    } else if (type === 'dependent') {
      setMemberType('existing');
      setLinkScope('self');
    } else {
      setMemberType('new');
      setLinkScope('self-dependent');
    }
    setStep(3);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 560, maxHeight: '92vh', background: '#fff', borderRadius: 20, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Back button (steps 2 & 3, individual mode) */}
            {mode === 'individual' && step > 1 && (
              <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F7F8FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#131C4E' }}>Add Member</p>
              {mode === 'individual' && (
                <p style={{ fontSize: 11, color: '#B0B7C9', marginTop: 1 }}>
                  Step {step} of 3 — {STEP_LABELS[step - 1]}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mode toggle — only on step 1 */}
            {step === 1 && (
              <div style={{ display: 'flex', background: '#F7F8FA', borderRadius: 10, padding: 3, gap: 2 }}>
                {(['individual', 'bulk'] as const).map((m) => (
                  <button key={m} onClick={() => { setMode(m); setStep(1); }}
                    style={{ height: 28, padding: '0 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                      background: mode === m ? '#fff' : 'transparent',
                      color: mode === m ? '#131C4E' : '#9CA3B8',
                      boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {m === 'individual' ? 'Single' : 'Bulk'}
                  </button>
                ))}
              </div>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F7F8FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3B8' }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Step indicator bar (individual only) */}
        {mode === 'individual' && (
          <div style={{ display: 'flex', padding: '0 24px', gap: 6, flexShrink: 0, paddingTop: 14, paddingBottom: 2 }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 4, transition: 'background 0.3s',
                background: s <= step ? '#F56B22' : '#F0F1F5' }} />
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Inline error banner */}
          {formError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
              <AlertCircle style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>{formError}</span>
            </div>
          )}

          {/* ── BULK mode ── */}
          {mode === 'bulk' && bulkStep === 'upload' && (
            <>
              {/* Scheme picker */}
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Plan / Scheme</p>
                <select value={bulkSchemeId} onChange={e => setBulkSchemeId(e.target.value)}
                  style={{ width: '100%', height: 42, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: bulkSchemeId ? '#131C4E' : '#9CA3B8', outline: 'none' }}>
                  <option value=''>Select a plan…</option>
                  {schemes.map(s => <option key={s.schemeId} value={s.schemeId}>{s.schemeName}</option>)}
                </select>
              </div>
              {/* Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setBulkDragOver(true); }}
                onDragLeave={() => setBulkDragOver(false)}
                onDrop={e => { e.preventDefault(); setBulkDragOver(false); const f = e.dataTransfer.files[0]; if (f) parseBulkFile(f); }}
                style={{ border: `2px dashed ${bulkDragOver ? '#F56B22' : '#E5E7F1'}`, borderRadius: 16, padding: '36px 24px', textAlign: 'center', background: bulkDragOver ? '#FFF8F5' : '#FAFBFC', transition: 'all 0.15s' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Upload style={{ width: 22, height: 22, color: '#F56B22' }} />
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 6 }}>Drop your Census file here</p>
                <p style={{ fontSize: 12, color: '#9CA3B8', marginBottom: 16 }}>Supports .csv and .xlsx · One member per row</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={() => bulkFileRef.current?.click()}
                    style={{ height: 38, padding: '0 20px', fontSize: 13, fontWeight: 600, color: '#3A4382', border: '1px solid #C7D2FE', borderRadius: 12, background: '#EEF2FF', cursor: 'pointer' }}>Browse File</button>
                  <button onClick={downloadBulkTemplate}
                    style={{ height: 38, padding: '0 16px', fontSize: 13, fontWeight: 600, color: '#6B7280', border: '1px solid #E5E7F1', borderRadius: 12, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <ArrowDownToLine style={{ width: 13, height: 13 }} /> Template
                  </button>
                </div>
                <input ref={bulkFileRef} type='file' accept='.csv,.xlsx,.xls' style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) parseBulkFile(f); }} />
              </div>
            </>
          )}

          {/* ── BULK — Review table ── */}
          {mode === 'bulk' && bulkStep === 'review' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{bulkRows.length} rows found · {bulkRows.filter(r => r.errors.length === 0).length} valid</p>
                <button onClick={() => { setBulkStep('upload'); setBulkRows([]); setBulkSelected(new Set()); }}
                  style={{ fontSize: 12, color: '#F56B22', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>← Re-upload</button>
              </div>
              {/* Scheme picker */}
              <div style={{ marginBottom: 12 }}>
                <select value={bulkSchemeId} onChange={e => setBulkSchemeId(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 12, background: '#FAFBFC', color: bulkSchemeId ? '#131C4E' : '#9CA3B8', outline: 'none' }}>
                  <option value=''>Select a plan…</option>
                  {schemes.map(s => <option key={s.schemeId} value={s.schemeId}>{s.schemeName}</option>)}
                </select>
              </div>
              {/* Select all */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #F3F4F6' }}>
                <input type='checkbox'
                  checked={bulkSelected.size === bulkRows.filter(r => r.errors.length === 0).length && bulkRows.filter(r => r.errors.length === 0).length > 0}
                  onChange={e => {
                    if (e.target.checked) setBulkSelected(new Set(bulkRows.filter(r => r.errors.length === 0).map(r => r.idx)));
                    else setBulkSelected(new Set());
                  }} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Select all valid ({bulkRows.filter(r => r.errors.length === 0).length})</span>
              </div>
              {/* Rows */}
              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bulkRows.map(row => {
                  const hasErr = row.errors.length > 0;
                  const checked = bulkSelected.has(row.idx);
                  return (
                    <div key={row.idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, border: `1px solid ${hasErr ? '#FEE2E2' : checked ? '#BBF7D0' : '#E5E7F1'}`, background: hasErr ? '#FFF5F5' : checked ? '#F0FFF4' : '#fff' }}>
                      <input type='checkbox' disabled={hasErr} checked={!hasErr && checked}
                        onChange={e => {
                          const s = new Set(bulkSelected);
                          if (e.target.checked) s.add(row.idx); else s.delete(row.idx);
                          setBulkSelected(s);
                        }} style={{ marginTop: 2, width: 14, height: 14, cursor: hasErr ? 'not-allowed' : 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{row.firstName} {row.surname} {row.otherNames ? `(${row.otherNames})` : ''}</p>
                        <p style={{ fontSize: 11, color: '#9CA3B8' }}>{row.employeeCode} · {row.email} · {row.mobile} · {row.dob} · {row.gender}</p>
                        {hasErr && <p style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{row.errors.join(', ')}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── BULK — Results ── */}
          {mode === 'bulk' && bulkStep === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E', marginBottom: 4 }}>
                Enrolment Results — {[...bulkProgress.values()].filter(v => v.status === 'ok').length} succeeded · {[...bulkProgress.values()].filter(v => v.status === 'error').length} failed · {[...bulkProgress.values()].filter(v => v.status === 'pending').length} pending
              </p>
              {bulkRows.filter(r => bulkProgress.has(r.idx)).map(row => {
                const prog = bulkProgress.get(row.idx);
                const icon = prog?.status === 'ok' ? '✓' : prog?.status === 'error' ? '✗' : '⏳';
                const color = prog?.status === 'ok' ? '#059669' : prog?.status === 'error' ? '#DC2626' : '#D97706';
                return (
                  <div key={row.idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7F1', background: '#FAFBFC' }}>
                    <span style={{ fontSize: 16, color, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{row.firstName} {row.surname}</p>
                      <p style={{ fontSize: 11, color: prog?.status === 'ok' ? '#059669' : prog?.status === 'error' ? '#DC2626' : '#9CA3B8' }}>
                        {prog?.status === 'ok' ? `Enrolled · ${prog.msg}` : prog?.status === 'error' ? prog.msg : 'Processing…'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── INDIVIDUAL — Step 1: How will this enrolment happen? ── */}
          {mode === 'individual' && step === 1 && (
            <>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                Choose how this member will be enrolled onto the plan.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div onClick={() => chooseMethod('link')}
                  style={{ padding: '20px 22px', borderRadius: 16, border: '1.5px solid #E5E7F1', background: '#fff', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 18 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#FFF8F5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F56B22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 3 }}>Member self-enrols</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.5 }}>Send the staff member a secure link — they fill in their own details</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C9D9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>

                <div onClick={() => chooseMethod('form')}
                  style={{ padding: '20px 22px', borderRadius: 16, border: '1.5px solid #E5E7F1', background: '#fff', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 18 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3A4382'; e.currentTarget.style.background = '#EEF2FF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3A4382" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 3 }}>HR adds directly</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.5 }}>HR fills in the member&apos;s details and submits on their behalf</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C9D9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            </>
          )}

          {/* ── INDIVIDUAL — Step 2: What type of enrolment? ── */}
          {mode === 'individual' && step === 2 && (
            <>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                {actionType === 'link' ? 'What link should be generated for this enrolment?' : 'What type of member is being added?'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div onClick={() => chooseType('principal')}
                  style={{ padding: '20px 22px', borderRadius: 16, border: '1.5px solid #E5E7F1', background: '#fff', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 18 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#FFF8F5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F56B22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 3 }}>Principal only</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.5 }}>Enrol a staff member — no dependants at this time</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C9D9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>

                <div onClick={() => chooseType('dependent')}
                  style={{ padding: '20px 22px', borderRadius: 16, border: '1.5px solid #E5E7F1', background: '#fff', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 18 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.background = '#F5F3FF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 3 }}>Existing staff&apos;s dependent</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.5 }}>Add a dependant to a staff member already on the plan</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C9D9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>

                <div onClick={() => chooseType('new-with-deps')}
                  style={{ padding: '20px 22px', borderRadius: 16, border: '1.5px solid #E5E7F1', background: '#fff', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 18 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.background = '#ECFDF5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E', marginBottom: 3 }}>New staff + dependants</p>
                    <p style={{ fontSize: 12, color: '#9CA3B8', lineHeight: 1.5 }}>Enrol a new staff member together with their dependants</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C9D9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
            </>
          )}

          {/* ── INDIVIDUAL — Step 3: Details ── */}
          {mode === 'individual' && step === 3 && (
            <>
              {/* ── LINK flow ── */}
              {actionType === 'link' && (
                <>
                  {/* Principal picker for dependent link */}
                  {memberType === 'existing' && (
                    <div style={{ background: '#F7F8FC', borderRadius: 14, padding: '14px 16px', border: selectedPrincipal ? '1.5px solid #10B981' : '1.5px solid #E5E7F1', marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Select Principal Staff Member *</p>
                      {selectedPrincipal ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{selectedPrincipal.firstName} {selectedPrincipal.lastName}</p>
                            <p style={{ fontSize: 11, color: '#6B7280' }}>{selectedPrincipal.employeeId}</p>
                            <p style={{ fontSize: 11, color: profileLoading ? '#9CA3B8' : '#059669', fontWeight: 600 }}>{profileLoading ? 'Loading plan…' : (principalProfile?.schemeName || resolveScheme(selectedPrincipal)?.schemeName || selectedPrincipal.plan)}</p>
                          </div>
                          <button onClick={() => { setSelectedPrincipal(null); setPrincipalProfile(null); setPrincipalSearch(''); setLinkEmpCode(''); setLinkEmail(''); }}
                            style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                            Change
                          </button>
                        </div>
                      ) : (
                        <>
                          <input value={principalSearch} onChange={(e) => setPrincipalSearch(e.target.value)}
                            placeholder="Type name or employee ID…"
                            style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                          {principalSearch.length >= 2 && (
                            <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', borderRadius: 10, border: '1px solid #E5E7F1', background: '#fff' }}>
                              {principals.filter((p) => {
                                const q = principalSearch.toLowerCase();
                                return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.employeeId.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                              }).slice(0, 8).map((p) => {
                                const sc = resolveScheme(p);
                                return (
                                  <div key={p.id} onClick={() => selectPrincipal(p)}
                                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FC')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', margin: 0 }}>{p.firstName} {p.lastName}</p>
                                    <p style={{ fontSize: 11, color: '#9CA3B8', margin: 0 }}>{p.employeeId} · {sc?.schemeName ?? p.plan}</p>
                                  </div>
                                );
                              })}
                              {principals.filter((p) => { const q = principalSearch.toLowerCase(); return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.employeeId.toLowerCase().includes(q) || p.email.toLowerCase().includes(q); }).length === 0 && (
                                <p style={{ padding: '12px 14px', fontSize: 12, color: '#9CA3B8', margin: 0 }}>No matching staff found</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Plan — only for non-dependent links */}
                  {memberType !== 'existing' && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#F56B22', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Select Plan *</p>
                      <div style={{ position: 'relative' }}>
                        {schemes.length > 0 ? (
                          <select value={selectedSchemeId} onChange={(e) => setSelectedSchemeId(e.target.value)}
                            style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', border: selectedSchemeId ? '1.5px solid #10B981' : '2px solid #F56B22', background: selectedSchemeId ? '#fff' : '#FFF8F5', paddingRight: 36, fontWeight: selectedSchemeId ? 600 : 400, color: selectedSchemeId ? '#131C4E' : '#9CA3B8' }}
                            onFocus={focusOn} onBlur={focusOff}>
                            <option value="">— Choose a plan —</option>
                            {schemes.map((s) => <option key={s.schemeId} value={s.schemeId}>{s.schemeName}</option>)}
                          </select>
                        ) : <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: '#B0B7C9' }}>Loading plans…</div>}
                        <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: selectedSchemeId ? '#10B981' : '#F56B22' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  )}

                  {/* Dependent count picker — for dep links and new-staff-with-deps links */}
                  {(memberType === 'existing' || linkScope === 'self-dependent') && (() => {
                    const depScheme = memberType === 'existing' && selectedPrincipal
                      ? resolveScheme(selectedPrincipal)
                      : selectedScheme ?? null;
                    const depSchemeMaxFamily = depScheme?.maxFamilySize ?? 8;
                    const principalCurrentDeps = memberType === 'existing' ? (selectedPrincipal?.dependants ?? 0) : 0;
                    const depSlotsLeft = Math.max(0, depSchemeMaxFamily - 1 - principalCurrentDeps);
                    return (
                      <div style={{ background: '#F7F8FC', borderRadius: 12, border: '1px solid #EDEEF2', padding: '12px 16px', marginBottom: 14 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>How many dependants can this link register?</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button onClick={() => setLinkMaxDeps((n) => Math.max(1, n - 1))}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E5E7F1', background: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#131C4E' }}>−</button>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <p style={{ fontSize: 22, fontWeight: 900, color: '#131C4E', lineHeight: 1 }}>{linkMaxDeps}</p>
                            <p style={{ fontSize: 10, color: '#9CA3B8', marginTop: 2 }}>dependant{linkMaxDeps !== 1 ? 's' : ''} allowed</p>
                          </div>
                          <button onClick={() => setLinkMaxDeps((n) => Math.min(depSlotsLeft, n + 1))}
                            disabled={linkMaxDeps >= depSlotsLeft}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #E5E7F1', background: '#fff', fontSize: 16, cursor: linkMaxDeps >= depSlotsLeft ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: linkMaxDeps >= depSlotsLeft ? '#D1D5DB' : '#131C4E' }}>+</button>
                        </div>
                        <p style={{ fontSize: 11, color: '#9CA3B8', textAlign: 'center', marginTop: 8 }}>
                          Plan limit: {depSchemeMaxFamily - 1} dependant{depSchemeMaxFamily - 1 !== 1 ? 's' : ''} max
                          {memberType === 'existing' && <> · {principalCurrentDeps} registered · <strong style={{ color: depSlotsLeft > 0 ? '#059669' : '#DC2626' }}>{depSlotsLeft} slot{depSlotsLeft !== 1 ? 's' : ''} remaining</strong></>}
                        </p>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                        {memberType === 'existing' ? 'Send Link To (Email) *' : 'Staff Email *'}
                      </p>
                      <input type="email" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)}
                        placeholder="e.g. john.doe@company.com" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                    </div>
                    {memberType !== 'existing' && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Employee Code *</p>
                        <input value={linkEmpCode} onChange={(e) => setLinkEmpCode(e.target.value)}
                          placeholder="e.g. EMP-9988" style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#9CA3B8', marginBottom: 16 }}>
                    {memberType === 'existing'
                      ? "The dependent enrolment link will be tied to this staff member's record."
                      : 'The link is tied to this email + employee code. Staff must verify both to enrol — preventing misuse.'}
                  </p>

                  {generatedUrl && (
                    <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: 14, padding: '14px 16px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4 }}>✓ Enrolment link sent to {linkEmail}</p>
                      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>The staff member will receive an email with the link. You can also copy it below as a backup:</p>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input id="generated-url-input" readOnly value={generatedUrl} style={{ ...inputStyle, flex: 1, background: '#fff', fontSize: 12 }} />
                        <button onClick={() => {
                          const inp = document.getElementById('generated-url-input') as HTMLInputElement | null;
                          if (inp) { inp.select(); inp.setSelectionRange(0, 99999); }
                          if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(generatedUrl)
                              .then(() => toast('Link copied!', 'success'))
                              .catch(() => { document.execCommand('copy'); toast('Link copied!', 'success'); });
                          } else {
                            document.execCommand('copy');
                            toast('Link copied!', 'success');
                          }
                        }}
                          style={{ height: 40, padding: '0 14px', fontSize: 12, fontWeight: 700, color: '#059669', border: '1px solid #BBF7D0', borderRadius: 10, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── FORM flow ── */}
              {actionType === 'form' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Principal picker — only for "existing staff's dependent" */}
                  {memberType === 'existing' && (
                    <div style={{ background: '#F7F8FC', borderRadius: 14, padding: '14px 16px', border: selectedPrincipal ? '1.5px solid #10B981' : '1.5px solid #E5E7F1' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Principal Staff Member *</p>
                      {selectedPrincipal ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#131C4E' }}>{selectedPrincipal.firstName} {selectedPrincipal.lastName}</p>
                            <p style={{ fontSize: 11, color: '#6B7280' }}>{selectedPrincipal.employeeId}</p>
                            <p style={{ fontSize: 11, color: profileLoading ? '#9CA3B8' : '#059669', fontWeight: 600 }}>{profileLoading ? 'Loading plan…' : (principalProfile?.schemeName || resolveScheme(selectedPrincipal)?.schemeName || selectedPrincipal.plan)}</p>
                            {!profileLoading && !principalProfile?.cifNumber && !selectedPrincipal.cifNumber && (
                              <p style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>⚠ No CIF found — try selecting again</p>
                            )}
                          </div>
                          <button onClick={() => { setSelectedPrincipal(null); setPrincipalProfile(null); setPrincipalSearch(''); }}
                            style={{ fontSize: 11, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>
                            Change
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            value={principalSearch}
                            onChange={(e) => setPrincipalSearch(e.target.value)}
                            placeholder="Type name or employee ID to search…"
                            style={inputStyle}
                            onFocus={focusOn} onBlur={focusOff}
                          />
                          {principalSearch.length >= 2 && (
                            <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', borderRadius: 10, border: '1px solid #E5E7F1', background: '#fff' }}>
                              {principals
                                .filter((p) => {
                                  const q = principalSearch.toLowerCase();
                                  return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.employeeId.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                                })
                                .slice(0, 8)
                                .map((p) => {
                                  const sc = resolveScheme(p);
                                  return (
                                    <div key={p.id} onClick={() => selectPrincipal(p)}
                                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F8FC')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                                      <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', margin: 0 }}>{p.firstName} {p.lastName}</p>
                                      <p style={{ fontSize: 11, color: '#9CA3B8', margin: 0 }}>{p.employeeId} · {sc?.schemeName ?? p.plan}</p>
                                    </div>
                                  );
                                })}
                              {principals.filter((p) => {
                                const q = principalSearch.toLowerCase();
                                return `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || p.employeeId.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
                              }).length === 0 && (
                                <p style={{ padding: '12px 14px', fontSize: 12, color: '#9CA3B8', margin: 0 }}>No matching staff found</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Photo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div onClick={() => photoRef.current?.click()} style={{ width: 68, height: 68, borderRadius: '50%', border: '2px dashed #D1D5DB', background: '#F7F8FC', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      {photoBase64
                        ? <img src={`data:${photoType};base64,${photoBase64}`} alt="passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Camera style={{ width: 22, height: 22, color: '#C4C9D9' }} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Passport Photo <span style={{ color: '#B0B7C9', fontWeight: 400 }}>(optional)</span></p>
                      <button type="button" onClick={() => photoRef.current?.click()}
                        style={{ height: 32, padding: '0 14px', fontSize: 12, fontWeight: 600, color: '#F56B22', border: '1.5px solid #FFD8C0', borderRadius: 8, background: '#FFF5EF', cursor: 'pointer' }}>
                        {photoBase64 ? 'Change' : 'Upload Photo'}
                      </button>
                    </div>
                    <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                  </div>

                  {/* Plan — hidden for "existing" since it's inherited from the principal */}
                  {memberType !== 'existing' && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#F56B22', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Select Plan *</p>
                      <div style={{ position: 'relative' }}>
                        {schemes.length > 0 ? (
                          <select value={selectedSchemeId} onChange={(e) => setSelectedSchemeId(e.target.value)}
                            style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', border: selectedSchemeId ? '1.5px solid #10B981' : '2px solid #F56B22', background: selectedSchemeId ? '#fff' : '#FFF8F5', paddingRight: 36, fontWeight: selectedSchemeId ? 600 : 400, color: selectedSchemeId ? '#131C4E' : '#9CA3B8' }}
                            onFocus={focusOn} onBlur={focusOff}>
                            <option value="">— Choose a plan —</option>
                            {schemes.map((s) => <option key={s.schemeId} value={s.schemeId}>{s.schemeName}</option>)}
                          </select>
                        ) : <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: '#B0B7C9' }}>Loading plans…</div>}
                        <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: selectedSchemeId ? '#10B981' : '#F56B22' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {[
                      { label: 'First Name *',    value: firstName,  set: setFirstName,  ph: 'e.g. Amaka'     },
                      { label: 'Surname *',       value: surname,    set: setSurname,    ph: 'e.g. Okafor'    },
                      { label: 'Other Names',     value: otherNames, set: setOtherNames, ph: 'Middle name(s)' },
                      ...(memberType !== 'existing' ? [{ label: 'Employee Code *', value: empCode, set: setEmpCode, ph: 'e.g. EMP-9988' }] : []),
                      { label: 'Email *',         value: email,      set: setEmail,      ph: 'amaka@company.com', type: 'email' },
                      { label: 'Mobile *',        value: mobile,     set: setMobile,     ph: '08012345678',   type: 'tel' },
                      { label: 'Alt. Mobile',     value: mobile2,    set: setMobile2,    ph: '07012345678',   type: 'tel' },
                      { label: 'Date of Birth *', value: dob,        set: setDob,        ph: '',              type: 'date' },
                    ].map((f) => (
                      <div key={f.label}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{f.label}</p>
                        <input type={f.type ?? 'text'} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                          style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                      </div>
                    ))}

                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Gender *</p>
                      <select value={sexId} onChange={(e) => setSexId(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={focusOn} onBlur={focusOff}>
                        <option value="">Select</option>
                        {genders.map((g) => <option key={g.value} value={g.value}>{g.text}</option>)}
                      </select>
                    </div>

                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Marital Status</p>
                      <select value={maritalStatus} onChange={(e) => setMarStatus(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={focusOn} onBlur={focusOff}>
                        <option value="">Select</option>
                        {maritalOpts.map((m) => <option key={m.value} value={m.value}>{m.text}</option>)}
                      </select>
                    </div>

                    {regionOpts.length > 0 ? (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Region</p>
                        <select value={regionId} onChange={(e) => handleRegionChange(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={focusOn} onBlur={focusOff}>
                          <option value="">Select region</option>
                          {regionOpts.map((r) => <option key={r.value} value={r.value}>{r.text}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>State</p>
                        <select value={stateId} onChange={(e) => setStateId(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={focusOn} onBlur={focusOff}>
                          <option value="">Select state</option>
                          {stateOpts.map((s) => <option key={s.value} value={s.value}>{s.text}</option>)}
                        </select>
                      </div>
                    )}

                    {regionId && (
                      <div>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Town</p>
                        <select value={townId} onChange={(e) => setTownId(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={focusOn} onBlur={focusOff} disabled={townsLoading}>
                          <option value="">{townsLoading ? 'Loading towns…' : 'Select town'}</option>
                          {townOpts.map((t) => <option key={t.value} value={t.value}>{t.text}</option>)}
                        </select>
                      </div>
                    )}

                    {memberType === 'existing' && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Relationship to Principal *</p>
                        <select value={relId} onChange={(e) => setRelId(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={focusOn} onBlur={focusOff}>
                          <option value="">Select relationship</option>
                          {relationshipOptions.map((r) => <option key={r.value} value={r.value}>{r.text}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Home Address</p>
                    <input value={address} onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 12 Adeola Odeku Street, Victoria Island"
                      style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                  </div>

                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Pre-existing Conditions</p>
                    <textarea value={preExisting} onChange={(e) => setPreExist(e.target.value)}
                      placeholder="List any pre-existing conditions, or leave blank if none"
                      rows={2}
                      style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical' }}
                      onFocus={focusOn} onBlur={focusOff} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — only shown on step 3 (or bulk mode) */}
        {(mode === 'bulk' || (mode === 'individual' && step === 3)) && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #F0F1F5', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
            <button onClick={onClose} style={{ height: 44, padding: '0 22px', fontSize: 14, fontWeight: 600, color: '#9CA3B8', background: '#F7F8FA', border: 'none', borderRadius: 14, cursor: 'pointer' }}>
              Cancel
            </button>
            {!(mode === 'individual' && actionType === 'link' && generatedUrl) && !(mode === 'bulk' && bulkStep === 'done') && (
              <button onClick={mode === 'bulk' && bulkStep === 'review' ? submitBulkRows : handleSubmit} disabled={submitting || (mode === 'bulk' && bulkStep === 'review' && bulkSelected.size === 0)}
                style={{ height: 44, padding: '0 28px', fontSize: 14, fontWeight: 700, color: '#fff', background: (submitting || (mode === 'bulk' && bulkStep === 'review' && bulkSelected.size === 0)) ? '#F0F1F5' : 'linear-gradient(135deg,#F56B22,#FF8C4B)', border: 'none', borderRadius: 14, cursor: (submitting || (mode === 'bulk' && bulkStep === 'review' && bulkSelected.size === 0)) ? 'not-allowed' : 'pointer', boxShadow: (submitting || (mode === 'bulk' && bulkStep === 'review' && bulkSelected.size === 0)) ? 'none' : '0 3px 12px rgba(245,107,34,0.35)' }}>
                {submitLabel}
              </button>
            )}
            {mode === 'bulk' && bulkStep === 'done' && (
              <button onClick={onClose} style={{ height: 44, padding: '0 28px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#059669,#10B981)', border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(16,185,129,0.3)' }}>
                Done
              </button>
            )}
            {mode === 'individual' && actionType === 'link' && generatedUrl && (
              <button onClick={onClose} style={{ height: 44, padding: '0 28px', fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#059669,#10B981)', border: 'none', borderRadius: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(16,185,129,0.3)' }}>
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Member 360 Drawer ───────────────────────────────────────────────── */
function Member360Drawer({ member, index, onClose, vis, relationshipOptions, stats, maxFamilySize, schemes }: { member: Member; index: number; onClose: () => void; vis: PeopleVis; relationshipOptions: RelationshipOption[]; stats?: MemberStats; maxFamilySize: number; schemes: PolicyScheme[] }) {
  const [drawerTab, setDrawerTab]           = useState<'overview' | 'claims' | 'benefits'>('overview');
  const [showAddDependent, setShowAddDep]   = useState(false);
  const [depAction, setDepAction]           = useState<'form' | 'link'>('form');
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null);
  const [sendingId, setSendingId]           = useState(false);
  const [depSubmitting, setDepSubmitting]   = useState(false);
  const [depError, setDepError]             = useState('');
  const [depGeneratedUrl, setDepGeneratedUrl] = useState('');

  // Dependent form state
  const [depFirstName, setDepFirstName]     = useState('');
  const [depLastName, setDepLastName]       = useState('');
  const [depDob, setDepDob]                 = useState('');
  const [depSexId, setDepSexId]             = useState('');
  const [depEmail, setDepEmail]             = useState('');
  const [depMobile, setDepMobile]           = useState('');
  const [depStateId, setDepStateId]         = useState('');
  const [depRelId, setDepRelId]             = useState('');
  const [depMarital, setDepMarital]         = useState('');

  // Link tab state
  const [depMaxCount, setDepMaxCount]       = useState(1);
  const [depLinkEmail, setDepLinkEmail]     = useState(member.email ?? '');
  const avatarInputRef                      = useRef<HTMLInputElement>(null);

  // Biodata: enriched phone + staffId fetched from GetEnrolleeBioDataByEnrolleeID
  const [bioPhone, setBioPhone]             = useState<string | null>(member.phone || null);
  const [bioStaffId, setBioStaffId]         = useState<string | null>(member.staffId || null);
  useEffect(() => {
    if (!member.employeeId) return;
    fetch(`/api/hr/members/biodata?enrolleeid=${encodeURIComponent(member.employeeId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.phone) setBioPhone(d.phone);
        if (d.staffId) setBioStaffId(d.staffId);
      })
      .catch(() => { /* silently ignore */ });
  }, [member.employeeId]);
  const { toast } = useToast();
  const plan   = planColors[member.plan]     ?? { bg: '#F1F5F9', text: '#475569' };
  const status = statusColors[member.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
  const grad   = avatarGradients[index % avatarGradients.length];
  const enroleeId = member.employeeId;
  const depCount  = member.dependants ?? 0;

  async function handleSendEnroleeId() {
    if (sendingId) return;
    if (!member.email) { toast('No email address on record for this member.', 'error'); return; }
    setSendingId(true);
    try {
      const res = await fetch('/api/hr/members/send-enrolee-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: member.email,
          enroleeId,
          memberName: `${member.firstName} ${member.lastName}`,
          schemeName: member.plan,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error ?? 'Failed to send email', 'error');
      } else {
        toast(`Enrolee ID sent to ${member.email}`, 'success');
      }
    } catch {
      toast('Failed to send email. Please try again.', 'error');
    } finally {
      setSendingId(false);
    }
  }

  // Use the member's own scheme family size if available, otherwise fall back to prop
  const memberScheme = schemes.find((s) => s.schemeId === member.schemeId);
  const memberMaxFamily = memberScheme?.maxFamilySize ?? maxFamilySize;
  const remainingSlots = Math.max(0, memberMaxFamily - 1 - depCount);
  // Resolved schemeId for API calls — member.id is NOT the schemeId
  const resolvedSchemeId = member.schemeId ?? memberScheme?.schemeId ?? '';

  async function handleDepSubmit() {
    if (depSubmitting) return;
    setDepError('');
    setDepSubmitting(true);
    try {
      if (depAction === 'form') {
        if (!depFirstName || !depLastName || !depDob || !depSexId || !depStateId || !depRelId) {
          setDepError('Please fill all required fields: First Name, Last Name, Date of Birth, Gender, State and Relationship.');
          return;
        }
        const res = await fetch('/api/hr/members/add-dependents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentCif: Number(member.cifNumber) || member.cifNumber,
            schemeId: resolvedSchemeId,
            schemeName: memberScheme?.schemeName ?? member.plan,
            employeeCode: member.employeeId,
            dependents: [{
              firstName: depFirstName,
              surname: depLastName,
              dateOfBirth: depDob,
              sexId: depSexId,
              maritalStatus: depMarital,
              email: depEmail,
              mobile: depMobile,
              postalTownId: depStateId,
              relationshipId: depRelId,
            }],
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setDepError(data.error ?? 'Failed to add dependent'); return; }
        toast(`Dependent added successfully!`, 'success');
        setShowAddDep(false);
      } else {
        // Send link
        if (!depLinkEmail) { setDepError('Member email is required to send the link.'); return; }
        const res = await fetch('/api/hr/members/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: depLinkEmail,
            employeeCode: member.employeeId,
            schemeId: resolvedSchemeId,
            schemeName: memberScheme?.schemeName ?? member.plan,
            inviteType: 'dependent',
            parentCif: String(member.cifNumber ?? ''),
            maxDependents: depMaxCount,
            scope: 'self-dependent',
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { setDepError(data.error ?? 'Failed to generate link'); return; }
        setDepGeneratedUrl(data.url);
        toast('Dependent enrolment link generated!', 'success');
      }
    } catch (err) {
      setDepError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setDepSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 460, background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#131C4E' }}>Member 360</p>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F7F8FA'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Profile */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 17, background: grad }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <>{member.firstName[0]}{member.lastName[0]}</>
                }
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                title="Change photo"
                style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: '#F56B22', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
                <Camera style={{ width: 9, height: 9, color: '#fff' }} />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => setAvatarPreview((ev.target?.result as string) ?? null);
                  reader.readAsDataURL(f);
                }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#131C4E', lineHeight: 1.2 }}>{member.firstName} {member.lastName}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF3E8', color: '#F56B22', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{enroleeId}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: plan.bg, color: plan.text }}>{member.plan}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: status.bg, color: status.text }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: status.dot }} />{member.status}
                </span>
                <span style={{ fontSize: 11, color: '#B8BFD0' }}>{member.type}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {[
              { Icon: Phone,    value: member.phone },
              { Icon: Mail,     value: member.email },
              { Icon: MapPin,   value: member.location },
              { Icon: Calendar, value: `Enrolled ${new Date(member.enrollmentDate).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}` },
            ].map(({ Icon, value }) => (
              <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 11, height: 11, color: '#9CA3B8' }} />
                </div>
                <span style={{ fontSize: 12, color: '#9CA3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #F0F1F5', flexShrink: 0 }}>
          {[
            { label: 'Dependants',  value: String(member.dependants ?? 0),                                  Icon: Users,       color: '#3A4382', bg: '#EEF2FF' },
            { label: 'Claims YTD',  value: String(stats?.claimsYtd ?? '—'),                                 Icon: Activity,    color: '#F56B22', bg: '#FFF3E8' },
            { label: 'Spend YTD',   value: stats ? `₦${Math.round(stats.totalSpendYtd).toLocaleString()}` : '—', Icon: ShieldCheck, color: '#10B981', bg: '#ECFDF5' },
          ].map((k, ki) => (
            <div key={k.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 8px', borderRight: ki < 2 ? '1px solid #F0F1F5' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                <k.Icon style={{ width: 15, height: 15, color: k.color }} strokeWidth={1.75} />
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#131C4E', lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</p>
              <p style={{ fontSize: 10, color: '#9CA3B8', fontWeight: 500, marginTop: 3 }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F5', flexShrink: 0, padding: '0 24px' }}>
          {(['overview', 'claims', 'benefits'] as const).map((tab) => (
            <button key={tab} onClick={() => setDrawerTab(tab)}
              style={{ padding: '13px 0', marginRight: 28, fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'all 0.15s', color: drawerTab === tab ? '#F56B22' : '#9CA3B8', borderBottom: `2px solid ${drawerTab === tab ? '#F56B22' : 'transparent'}` }}>
              {tab === 'overview' ? 'Overview' : tab === 'claims' ? 'Claim History' : 'Benefits'}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── Overview ── */}
          {drawerTab === 'overview' && (
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Personal Details</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 20px', marginBottom: 24 }}>
                {[
                  { label: 'Date of Birth',       value: member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                  { label: 'Gender',              value: member.gender },
                  { label: 'Plan',                value: member.plan },
                  { label: 'Member Type',         value: member.type },
                  { label: 'Phone',               value: bioPhone || '—' },
                  { label: 'Staff ID',            value: bioStaffId || '—' },
                  { label: 'State',               value: member.location || '—' },
                  { label: 'Dependants',          value: String(member.dependants ?? 0) },
                  { label: 'Individual Premium',  value: member.premium != null ? `₦${Math.round(member.premium).toLocaleString('en-NG')}` : '—' },
                ].map((row) => (
                  <div key={row.label}>
                    <p style={{ fontSize: 10, color: '#B0B7C9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{row.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#131C4E' }}>{row.value}</p>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: '#F0F1F5', marginBottom: 24 }} />

              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Utilization · {new Date().getFullYear()}</p>
              {stats ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'Total Spend YTD', value: `₦${Math.round(stats.totalSpendYtd).toLocaleString()}`, color: '#131C4E' },
                    { label: 'Visits Count',     value: `${stats.visitsYtd} visit${stats.visitsYtd !== 1 ? 's' : ''}`, color: '#131C4E' },
                    { label: 'Avg Per Visit',    value: stats.visitsYtd > 0 ? `₦${Math.round(stats.totalSpendYtd / stats.visitsYtd).toLocaleString()}` : '—', color: '#131C4E' },
                  ].map((r) => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#9CA3B8' }}>{r.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#C4C9D9' }}>No utilization data for this member yet.</p>
              )}
            </div>
          )}

          {/* ── Claim History ── */}
          {drawerTab === 'claims' && (
            <div style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Recent Claims</p>
              {stats && stats.recentClaims.length > 0 ? (
                <div>
                  {stats.recentClaims.map((c, i) => {
                    const ic = categoryIconColors[c.category] ?? { bg: '#F7F8FA', color: '#9CA3B8' };
                    const fmtDate = (() => {
                      if (!c.date) return '';
                      const d = c.date.slice(0, 10);
                      const parts = d.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                      if (!parts) return c.date;
                      try {
                        const dt = d.includes('-')
                          ? new Date(+parts[1], +parts[2] - 1, +parts[3])
                          : new Date(+parts[3], +parts[2] - 1, +parts[1]);
                        return dt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
                      } catch { return c.date; }
                    })();
                    const statusColor = c.status.toLowerCase().includes('paid') || c.status.toLowerCase().includes('approv') ? '#059669' : c.status.toLowerCase().includes('reject') ? '#DC2626' : '#D97706';
                    const statusBg    = c.status.toLowerCase().includes('paid') || c.status.toLowerCase().includes('approv') ? '#ECFDF5' : c.status.toLowerCase().includes('reject') ? '#FEF2F2' : '#FFFBEB';
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < stats.recentClaims.length - 1 ? '1px solid #F7F8FA' : 'none' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: ic.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Activity style={{ width: 16, height: 16, color: ic.color }} strokeWidth={1.75} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.provider || 'Unknown Provider'}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, background: ic.bg, color: ic.color, padding: '1px 7px', borderRadius: 20 }}>{c.category}</span>
                            <span style={{ fontSize: 10, color: '#B0B7C9' }}>{fmtDate}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#131C4E' }}>₦{Math.round(c.amount).toLocaleString()}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: statusBg, padding: '1px 7px', borderRadius: 20 }}>{c.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#C4C9D9', padding: '20px 0' }}>No claims found for this member in {new Date().getFullYear()}.</p>
              )}
            </div>
          )}

          {/* ── Benefits ── */}
          {drawerTab === 'benefits' && (
            <div style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#C4C9D9', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Benefit Limits · {member.plan}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  { cat: 'Outpatient', limit: '₦5,000,000', used: '₦28,500',   pct: 1,  color: '#F56B22' },
                  { cat: 'Inpatient',  limit: '₦5,000,000', used: '₦312,000',  pct: 6,  color: '#2563EB' },
                  { cat: 'Dental',     limit: '₦150,000',   used: '₦45,000',   pct: 30, color: '#F59E0B' },
                  { cat: 'Optical',    limit: '₦80,000',    used: '₦22,000',   pct: 28, color: '#7C3AED' },
                  { cat: 'Maternity',  limit: '₦400,000',   used: '₦0',        pct: 0,  color: '#EC4899' },
                ].map((b) => {
                  const barColor = b.pct > 80 ? '#EF4444' : b.pct > 50 ? '#F59E0B' : b.color;
                  return (
                    <div key={b.cat}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'block', flexShrink: 0 }} />
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>{b.cat}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#131C4E' }}>{b.used}</span>
                          <span style={{ fontSize: 11, color: '#B0B7C9' }}> / {b.limit}</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: '#F0F1F5', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: barColor, width: `${b.pct}%`, minWidth: b.pct > 0 ? 6 : 0, transition: 'width 0.4s' }} />
                      </div>
                      <p style={{ fontSize: 10, color: '#B0B7C9', marginTop: 4 }}>{b.pct}% utilised</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #F0F1F5', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Row 1 — Send Enrolee ID + Add Dependent (principals only) */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSendEnroleeId}
              disabled={sendingId}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: sendingId ? '#9CA3B8' : '#3A4382', border: '1px solid #C7D2FE', borderRadius: 14, background: sendingId ? '#F7F8FA' : 'linear-gradient(135deg,#F8F9FF,#EEF2FF)', cursor: sendingId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}>
              <Send style={{ width: 14, height: 14 }} /> {sendingId ? 'Sending…' : 'Send Enrolee ID'}
            </button>
            {member.type === 'Principal' && (
              <button
                onClick={() => setShowAddDep(true)}
                style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#10B981,#059669)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}>
                <UserPlus style={{ width: 14, height: 14 }} /> Add Dependent
              </button>
            )}
          </div>
          {/* Row 2 — Edit / E-Card / Terminate */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => toast('Member record opened for editing.')}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#3A4382', border: '1px solid #C7D2FE', borderRadius: 14, background: '#EEF2FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Edit Member
            </button>
            <button
              onClick={() => toast("E-Card sent to member's email.")}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <CreditCard style={{ width: 14, height: 14 }} /> E-Card
            </button>
            {vis.showTerminateAction && (
            <button
              onClick={() => { toast('Member terminated successfully.', 'error'); onClose(); }}
              style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#fff', border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#EF4444,#DC2626)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 2px 8px rgba(239,68,68,0.28)' }}>
              <AlertCircle style={{ width: 14, height: 14 }} /> Terminate
            </button>
            )}
          </div>
        </div>

        {/* ── Add Dependent bottom sheet ── */}
        {showAddDependent && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: '#fff', borderTop: '2px solid #F0F1F5',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -12px 40px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '78%', zIndex: 10,
          }}>
            {/* drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 6px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: '#E5E7F1' }} />
            </div>

            {/* sheet header */}
            <div style={{ padding: '4px 24px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#131C4E' }}>Add Dependent</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: 12, color: '#9CA3B8' }}>{member.firstName} {member.lastName}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: depCount > 0 ? '#FFF3E8' : '#F0F1F5',
                    color: depCount > 0 ? '#F56B22' : '#9CA3B8',
                  }}>
                    {depCount} existing dependant{depCount !== 1 ? 's' : ''}
                  </span>
                  {depCount >= memberMaxFamily - 1 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626' }}>
                      Max {memberMaxFamily - 1} dependant{memberMaxFamily - 1 !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setShowAddDep(false)}
                style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#F7F8FA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: 15, height: 15, color: '#9CA3B8' }} />
              </button>
            </div>

            <div style={{ height: 1, background: '#F0F1F5', flexShrink: 0 }} />

            {/* action toggle */}
            <div style={{ padding: '14px 24px 10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', background: '#F7F8FC', borderRadius: 12, padding: 3, gap: 3 }}>
                {([
                  { key: 'form', label: 'HR Fills Form' },
                  { key: 'link', label: 'Send Link to Member' },
                ] as const).map((opt) => (
                  <button key={opt.key} onClick={() => setDepAction(opt.key)}
                    style={{
                      flex: 1, height: 36, fontSize: 13, fontWeight: 600, borderRadius: 9,
                      border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: depAction === opt.key ? '#fff' : 'transparent',
                      color: depAction === opt.key ? '#131C4E' : '#9CA3B8',
                      boxShadow: depAction === opt.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* scrollable form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 8px' }}>

              {/* Error banner */}
              {depError && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                  <AlertCircle style={{ width: 14, height: 14, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: '#DC2626', lineHeight: 1.5 }}>{depError}</span>
                </div>
              )}

              {/* ── HR fills form ── */}
              {depAction === 'form' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {([
                      { label: 'First Name *',    value: depFirstName, set: setDepFirstName, ph: 'e.g. Chidi'   },
                      { label: 'Last Name *',     value: depLastName,  set: setDepLastName,  ph: member.lastName },
                      { label: 'Email',           value: depEmail,     set: setDepEmail,     ph: 'optional', type: 'email' },
                      { label: 'Mobile',          value: depMobile,    set: setDepMobile,    ph: 'optional', type: 'tel'   },
                      { label: 'Date of Birth *', value: depDob,       set: setDepDob,       ph: '',         type: 'date'  },
                    ] as Array<{label:string;value:string;set:(v:string)=>void;ph:string;type?:string}>).map((f) => (
                      <div key={f.label}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{f.label}</p>
                        <input type={f.type ?? 'text'} value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                          style={{ width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#10B981'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; }} />
                      </div>
                    ))}
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Gender *</p>
                      <select value={depSexId} onChange={(e) => setDepSexId(e.target.value)}
                        style={{ width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: depSexId ? '#131C4E' : '#9CA3B8', outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }}>
                        <option value="">Select</option>
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Marital Status</p>
                      <select value={depMarital} onChange={(e) => setDepMarital(e.target.value)}
                        style={{ width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: depMarital ? '#131C4E' : '#9CA3B8', outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }}>
                        <option value="">Select</option>
                        <option value="1">Single</option>
                        <option value="2">Married</option>
                        <option value="3">Divorced</option>
                        <option value="4">Widowed</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>State *</p>
                      <select value={depStateId} onChange={(e) => setDepStateId(e.target.value)}
                        style={{ width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: depStateId ? '#131C4E' : '#9CA3B8', outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }}>
                        <option value="">Select state</option>
                        {/* populated from parent via relationshipOptions — states passed as prop elsewhere; use hardcoded common ones */}
                        {[{v:'1',t:'Abia'},{v:'2',t:'Adamawa'},{v:'3',t:'Akwa Ibom'},{v:'4',t:'Anambra'},{v:'5',t:'Bauchi'},{v:'6',t:'Bayelsa'},{v:'7',t:'Benue'},{v:'8',t:'Borno'},{v:'9',t:'Cross River'},{v:'10',t:'Delta'},{v:'11',t:'Ebonyi'},{v:'12',t:'Edo'},{v:'13',t:'Ekiti'},{v:'14',t:'Enugu'},{v:'15',t:'FCT'},{v:'16',t:'Gombe'},{v:'17',t:'Imo'},{v:'18',t:'Jigawa'},{v:'19',t:'Kaduna'},{v:'20',t:'Kano'},{v:'21',t:'Katsina'},{v:'22',t:'Kebbi'},{v:'23',t:'Kogi'},{v:'24',t:'Kwara'},{v:'25',t:'Lagos'},{v:'26',t:'Nasarawa'},{v:'27',t:'Niger'},{v:'28',t:'Ogun'},{v:'29',t:'Ondo'},{v:'30',t:'Osun'},{v:'31',t:'Oyo'},{v:'32',t:'Plateau'},{v:'33',t:'Rivers'},{v:'34',t:'Sokoto'},{v:'35',t:'Taraba'},{v:'36',t:'Yobe'},{v:'37',t:'Zamfara'}].map((s) => <option key={s.v} value={s.v}>{s.t}</option>)}
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Relationship *</p>
                      <select value={depRelId} onChange={(e) => setDepRelId(e.target.value)}
                        style={{ width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: depRelId ? '#131C4E' : '#9CA3B8', outline: 'none', boxSizing: 'border-box', appearance: 'none', cursor: 'pointer' }}>
                        <option value="">Select relationship</option>
                        {relationshipOptions.filter((r) => r.text !== 'Main member').map((r) => (
                          <option key={r.value} value={r.value}>{r.text}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {!member.cifNumber && (
                    <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
                      <p style={{ fontSize: 11, color: '#D97706' }}>⚠ Principal CIF not available — dependent may fail. Try refreshing the member list.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Send link to member ── */}
              {depAction === 'link' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Max dependents selector */}
                  <div style={{ background: '#F7F8FC', borderRadius: 14, border: '1px solid #EDEEF2', padding: '14px 16px' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                      How many dependants can this link register?
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button onClick={() => setDepMaxCount((n) => Math.max(1, n - 1))}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E5E7F1', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#131C4E' }}>−</button>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <p style={{ fontSize: 28, fontWeight: 900, color: '#131C4E', lineHeight: 1 }}>{depMaxCount}</p>
                        <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 2 }}>
                          dependant{depMaxCount !== 1 ? 's' : ''} allowed
                        </p>
                      </div>
                      <button
                        onClick={() => setDepMaxCount((n) => Math.min(remainingSlots, n + 1))}
                        disabled={depMaxCount >= remainingSlots}
                        style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #E5E7F1', background: '#fff', fontSize: 18, cursor: depMaxCount >= remainingSlots ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: depMaxCount >= remainingSlots ? '#D1D5DB' : '#131C4E' }}>+</button>
                    </div>
                    <p style={{ fontSize: 11, color: '#9CA3B8', textAlign: 'center', marginTop: 8 }}>
                      Plan limit: {memberMaxFamily - 1} dependant{memberMaxFamily - 1 !== 1 ? 's' : ''} total · {depCount} already registered · <strong style={{ color: remainingSlots > 0 ? '#059669' : '#DC2626' }}>{remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining</strong>
                    </p>
                  </div>

                  {/* Email */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Send Link To</p>
                    <input type="email" value={depLinkEmail} onChange={(e) => setDepLinkEmail(e.target.value)}
                      placeholder="member@company.com"
                      style={{ width: '100%', height: 38, padding: '0 12px', fontSize: 13, border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#10B981'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; }} />
                  </div>

                  <div style={{ padding: '12px 14px', background: '#ECFDF5', borderRadius: 12, border: '1px solid #BBF7D0' }}>
                    <p style={{ fontSize: 12, color: '#059669', lineHeight: 1.6 }}>
                      {member.firstName} will receive a secure link to register up to <strong>{depMaxCount}</strong> dependant{depMaxCount !== 1 ? 's' : ''} themselves.
                    </p>
                  </div>

                  {remainingSlots === 0 && (
                    <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>⚠ This member has used all dependant slots on their plan. Adding more may be rejected.</p>
                    </div>
                  )}

                  {/* Generated link */}
                  {depGeneratedUrl && (
                    <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: 12, padding: '12px 14px' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 8 }}>Link ready — copy and share:</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input readOnly value={depGeneratedUrl} style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 11, border: '1px solid #BBF7D0', borderRadius: 8, background: '#fff', color: '#131C4E', outline: 'none' }} />
                        <button onClick={() => {
                          const ta = document.createElement('textarea');
                          ta.value = depGeneratedUrl;
                          ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
                          document.body.appendChild(ta);
                          ta.select(); ta.setSelectionRange(0, 99999);
                          try { document.execCommand('copy'); } catch { /* ignore */ }
                          document.body.removeChild(ta);
                          if (navigator.clipboard?.writeText) navigator.clipboard.writeText(depGeneratedUrl).catch(() => {});
                          toast('Link copied!', 'success');
                        }} style={{ height: 36, padding: '0 12px', fontSize: 12, fontWeight: 700, color: '#059669', border: '1px solid #BBF7D0', borderRadius: 8, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* sheet footer */}
            <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F0F1F5', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => { setShowAddDep(false); setDepError(''); setDepGeneratedUrl(''); }}
                style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 600, color: '#9CA3B8', background: '#F7F8FA', border: 'none', borderRadius: 14, cursor: 'pointer' }}>
                {depGeneratedUrl ? 'Done' : 'Cancel'}
              </button>
              {!depGeneratedUrl && (
                <button onClick={handleDepSubmit} disabled={depSubmitting}
                  style={{ flex: 2, height: 42, fontSize: 13, fontWeight: 700, color: '#fff', background: depSubmitting ? '#F0F1F5' : 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 14, cursor: depSubmitting ? 'not-allowed' : 'pointer', boxShadow: depSubmitting ? 'none' : '0 2px 8px rgba(16,185,129,0.28)' }}>
                  {depSubmitting ? 'Please wait…' : depAction === 'form' ? 'Add Dependent' : 'Generate & Send Link'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}


/* ── Members Page ────────────────────────────────────────────────────── */
export default function MembersPage() {
  const [vis, setVis] = useState<PeopleVis>(DEFAULTS.people);
  useEffect(() => { setVis(getVis('people')); }, []);

  const [search, setSearch]               = useState('');
  const [planFilter, setPlanFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [selected, setSelected]           = useState<string[]>([]);
  const [activeMember, setActiveMember]   = useState<{ member: Member; index: number } | null>(null);
  const [showAddModal, setShowAddModal]   = useState<false | 'individual' | 'bulk'>(false);
  const [viewBeneficiaries, setViewBeneficiaries] = useState(false);
  const [relationshipOptions, setRelationshipOptions] = useState<RelationshipOption[]>([]);
  const { toast } = useToast();

  // Policy schemes — used for dependant limit validation and plan dropdown in AddMemberModal
  const [schemes, setSchemes] = useState<PolicyScheme[]>([]);
  const [maxFamilySize, setMaxFamilySize] = useState<number>(8);
  useEffect(() => {
    fetch('/api/hr/benefits/schemes')
      .then((r) => r.json())
      .then((d) => {
        const loaded: PolicyScheme[] = d.schemes ?? [];
        setSchemes(loaded);
        const sizes = loaded.map((s) => s.maxFamilySize).filter((n): n is number => n !== null && n > 0);
        if (sizes.length > 0) setMaxFamilySize(Math.min(...sizes));
      })
      .catch(() => {});
  }, []);

  // Live data
  const [liveMembers, setLiveMembers]       = useState<Member[]>([]);
  const [memberStatsMap, setMemberStatsMap] = useState<Record<string, MemberStats>>({});
  const [pageStats, setPageStats]           = useState<{ activeCount: number; totalCount: number; principalCount: number; dependantCount: number; newThisMonth: number; pendingCount: number } | null>(null);
  const [membersLoading, setMembersLoading] = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [page, setPage]                     = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetch('/api/hr/list-values')
      .then((r) => r.json())
      .then((d) => { if (d.relationships?.length) setRelationshipOptions(d.relationships); })
      .catch(() => {});
  }, []);

  const loadMembers = useCallback(async (fresh = false) => {
    if (fresh) setRefreshing(true);
    else setMembersLoading(true);
    setPage(0);

    const qs = new URLSearchParams({ skipClaims: '1', ...(fresh ? { fresh: '1' } : {}) });
    try {
      const d = await fetch(`/api/hr/members?${qs}`).then((r) => r.json());
      if (d.members) setLiveMembers(d.members);
      if (d.stats)   setPageStats(d.stats);
    } catch { /* keep showing whatever was there */ }
    finally {
      setMembersLoading(false);
      setRefreshing(false);
    }

    // Background: fetch full response (with claims) — updates stats when ready
    try {
      const qs2 = new URLSearchParams(fresh ? { fresh: '1' } : {});
      const d2 = await fetch(`/api/hr/members${qs2.toString() ? `?${qs2}` : ''}`).then((r) => r.json());
      if (d2.memberStats) setMemberStatsMap(d2.memberStats);
      if (d2.stats) setPageStats(d2.stats); // update stats too (full response has same stats)
    } catch { /* claims stats are optional */ }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Reset to page 0 whenever search/filter changes
  useEffect(() => { setPage(0); }, [search, planFilter, statusFilter, viewBeneficiaries]);

  const principals = liveMembers.filter((m) => m.type === 'Principal');
  const allBeneficiaries = liveMembers;

  const sourceList = viewBeneficiaries ? allBeneficiaries : principals;

  // Dynamic filter options — only show values that exist in the current source list
  const availablePlans    = ['All Plans',   ...Array.from(new Set(sourceList.map((m) => m.plan))).sort()];
  const availableStatuses = ['All Status',  ...Array.from(new Set(sourceList.map((m) => m.status))).sort()];

  const filtered = sourceList.filter((m) => {
    const q = search.toLowerCase();
    return (!q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || m.employeeId.toLowerCase().includes(q) || m.phone.includes(q))
      && (!planFilter || m.plan === planFilter)
      && (!statusFilter || m.status === statusFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const paged      = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSelect = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const allSelected  = filtered.length > 0 && selected.length === filtered.length;
  const someSelected = selected.length > 0 && !allSelected;
  const toggleAll    = () => setSelected(allSelected ? [] : filtered.map((m) => m.id));

  const card: React.CSSProperties = {
    background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  };

  // Covered lives = Active only, for uniformity across all views
  const principalCount = liveMembers.filter((m) => m.type === 'Principal' && m.status === 'Active').length;
  const dependantCount = liveMembers.filter((m) => m.type === 'Dependant' && m.status === 'Active').length;

  return (
    <div style={{ background: '#F7F8FC', minHeight: '100%' }}>
      <TopBar title="People" subtitle={`Member Management · ${pageStats ? pageStats.activeCount.toLocaleString() : '—'} active lives`} />

      <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Summary cards — 3 columns (Pending Terminations removed) */}
        {vis.showSummaryCards && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {SUMMARY_CARD_DEFS.map((c) => {
            const val = pageStats ? pageStats[c.key] : null;
            return (
              <div key={c.label} style={{ ...card, padding: '22px 22px 22px 20px', borderLeft: `3px solid ${c.color}` }}>
                <p style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10, color: '#131C4E' }}>
                  {membersLoading ? '…' : val != null ? val.toLocaleString() : '—'}
                </p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#131C4E', marginBottom: 3 }}>{c.label}</p>
                <p style={{ fontSize: 11, fontWeight: 500, color: '#9CA3B8' }}>{c.sub}</p>
              </div>
            );
          })}
        </div>
        )}

        {/* Toolbar */}
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 440 }}>
              <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#C4C9D9' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or phone..."
                style={{ width: '100%', height: 42, paddingLeft: 44, paddingRight: 16, fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
            </div>
            {[
              { value: planFilter,   setter: setPlanFilter,   options: availablePlans },
              { value: statusFilter, setter: setStatusFilter, options: availableStatuses },
            ].map(({ value, setter, options }) => (
              <select key={options[0]} value={value} onChange={(e) => setter(e.target.value)}
                style={{ height: 42, padding: '0 34px 0 14px', fontSize: 13, border: '1px solid #E5E7F1', borderRadius: 14, background: '#FAFBFC', color: '#131C4E', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                {options.map((o) => <option key={o} value={o === options[0] ? '' : o}>{o}</option>)}
              </select>
            ))}
            <div style={{ flex: 1 }} />

            {/* View toggle: Members / All Beneficiaries */}
            {vis.showBeneficiaryView && (
            <div style={{ display: 'flex', background: '#F7F8FC', borderRadius: 12, padding: 3, border: '1px solid #E5E7F1', gap: 2 }}>
              {([false, true] as const).map((val) => (
                <button key={String(val)} onClick={() => setViewBeneficiaries(val)}
                  style={{
                    height: 34, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    background: viewBeneficiaries === val ? '#fff' : 'transparent',
                    color: viewBeneficiaries === val ? '#131C4E' : '#9CA3B8',
                    boxShadow: viewBeneficiaries === val ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {val ? 'All Beneficiaries' : 'Members'}
                </button>
              ))}
            </div>
            )}

            <div style={{ width: 1, height: 28, background: '#E5E7F1' }} />
            <button onClick={() => setShowAddModal('bulk')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 500, color: '#3A4382', border: '1px solid #E5E7F1', borderRadius: 14, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Upload style={{ width: 15, height: 15 }} /> Bulk Upload
            </button>
            <button onClick={() => loadMembers(true)} disabled={refreshing}
              title="Refresh member list from Prognosis"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 700, background: refreshing ? '#F0FDF4' : 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', color: '#059669', border: '1px solid #A7F3D0', borderRadius: 14, cursor: refreshing ? 'wait' : 'pointer', whiteSpace: 'nowrap', opacity: refreshing ? 0.8 : 1 }}>
              <svg style={{ width: 15, height: 15, animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button onClick={() => exportToXls(filtered.map((m) => ({ 'Enrolee ID': m.employeeId, 'Staff ID': m.staffId ?? '', 'First Name': m.firstName, 'Last Name': m.lastName, 'Gender': m.gender, 'DOB': m.dateOfBirth, 'Phone': m.phone, 'Email': m.email, 'Plan': m.plan, 'Type': m.type, 'Status': m.status, 'Location': m.location })), 'members-export')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 18px', fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <ArrowDownToLine style={{ width: 15, height: 15 }} /> Export XLS
            </button>
            {vis.showAddMember && (
            <button onClick={() => setShowAddModal('individual')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 22px', fontSize: 13, fontWeight: 700, color: '#fff', borderRadius: 24, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 3px 12px rgba(245,107,34,0.35)', whiteSpace: 'nowrap' }}>
              <Plus style={{ width: 16, height: 16 }} /> Add Member
            </button>
            )}
          </div>
        </div>

        {/* Beneficiaries summary banner */}
        {viewBeneficiaries && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 14 }}>
            <Users style={{ width: 18, height: 18, color: '#0284C7', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0C4A6E' }}>
              All Beneficiaries View — {principalCount} active principals + {dependantCount} active dependants = {principalCount + dependantCount} active covered lives
            </span>

            <span style={{ fontSize: 12, color: '#38BDF8', marginLeft: 'auto' }}>Showing all covered lives including dependants</span>
          </div>
        )}

        {/* Bulk actions */}
        {selected.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #FFD8C0', boxShadow: '0 4px 16px rgba(245,107,34,0.10)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 800 }}>{selected.length}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#131C4E' }}>member{selected.length > 1 ? 's' : ''} selected</span>
            </div>
            <div style={{ width: 1, height: 24, background: '#F0F1F5', flexShrink: 0, margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'Approve Additions',   Icon: Plus,            color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
                { label: 'Send Enrolee IDs',     Icon: Send,            color: '#3730A3', bg: '#EEF2FF', border: '#C7D2FE' },
                { label: 'Download E-Cards',     Icon: CreditCard,      color: '#0369A1', bg: '#F0F9FF', border: '#BAE6FD' },
                { label: 'Export List',          Icon: ArrowDownToLine, color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
                { label: 'Send Invite Links',    Icon: Link2,           color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Request Correction',   Icon: FileText,        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              ].map(({ label, Icon, color, bg, border }) => (
                <button key={label}
                  onClick={() => toast(`${label} action applied to ${selected.length} member${selected.length > 1 ? 's' : ''}.`, 'info')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 14, border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <Icon style={{ width: 13, height: 13 }} /> {label}
                </button>
              ))}
            </div>
            <button onClick={() => setSelected([])} style={{ fontSize: 12, fontWeight: 500, color: '#9CA3B8', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, flexShrink: 0 }}>✕ Clear</button>
          </div>
        )}

        {/* Members / Beneficiaries table */}
        <div style={{ ...card }}>
          <div className="grid items-center border-b border-[#F0F1F5] bg-[#FAFBFC]"
            style={{ gridTemplateColumns: '36px 1fr 80px 132px 118px 76px 108px 120px 96px', columnGap: 12, padding: '12px 24px', color: '#B0B7C9', letterSpacing: '0.07em', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} title="Select all" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={toggleAll} title="Click to select all">
              <span className="text-[10.5px] font-bold text-[#9CA3B8] uppercase tracking-widest select-none">
                {viewBeneficiaries ? 'Beneficiary' : 'Member'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: '#C4C9D9', background: '#F0F1F5', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em' }}>SELECT ALL</span>
            </div>
            {['Staff ID', 'Enrolee ID', 'Plan', 'Type', 'Status', 'Phone', 'Dependents Count'].map((h) => (
              <span key={h} className="text-[10.5px] font-bold uppercase">{h}</span>
            ))}
          </div>

          {paged.map((m, i) => {
            const globalIndex = safePage * PAGE_SIZE + i;
            const plan   = planColors[m.plan]     ?? { bg: '#F1F5F9', text: '#475569' };
            const status = statusColors[m.status] ?? { bg: '#F1F5F9', text: '#475569', dot: '#9CA3B8' };
            const isSel  = selected.includes(m.id);
            const isDependant = m.type === 'Dependant';
            return (
              <div
                key={m.id}
                className={`grid items-center border-b border-[#F7F8FA] last:border-0 hover:bg-[#FAFBFC] cursor-pointer transition-colors ${isSel ? 'bg-[#FFF8F5]' : ''}`}
                style={{ gridTemplateColumns: '36px 1fr 80px 132px 118px 76px 108px 120px 96px', columnGap: 12, padding: '16px 24px', borderLeft: isDependant && viewBeneficiaries ? '3px solid #E0E7FF' : '3px solid transparent' }}
                onClick={() => setActiveMember({ member: m, index: globalIndex })}
              >
                <Checkbox checked={isSel} onChange={() => toggleSelect(m.id)} onClick={(e) => e.stopPropagation()} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {isDependant && viewBeneficiaries && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#6366F1', background: '#EEF2FF', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>DEP</span>
                  )}
                  <p className="text-[13px] font-semibold text-[#131C4E] truncate">{m.firstName} {m.lastName}</p>
                </div>
                <span className="text-[11px] text-[#131C4E] font-mono">{m.staffId || '—'}</span>
                <span className="text-[11px] text-[#131C4E] font-mono font-semibold">{m.employeeId}</span>
                <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: plan.bg, color: plan.text }}>{m.plan}</span>
                <span className="text-[11px]" style={{ color: isDependant ? '#6366F1' : '#9CA3B8', fontWeight: isDependant ? 600 : 400 }}>{m.type}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold w-fit" style={{ background: status.bg, color: status.text }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />{m.status}
                </span>
                <span className="text-[11px] text-[#9CA3B8]">{m.phone}</span>
                {m.type === 'Principal' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#131C4E' }}>{m.dependants ?? 0}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: (m.dependants ?? 0) > 0 ? '#F56B22' : '#C4C9D9', background: (m.dependants ?? 0) > 0 ? '#FFF3E8' : '#F7F8FA', padding: '1px 6px', borderRadius: 6 }}>
                      {(m.dependants ?? 0) > 0 ? `dep${(m.dependants ?? 0) > 1 ? 's' : ''}` : 'none'}
                    </span>
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#C4C9D9' }}>—</span>
                )}
              </div>
            );
          })}

          {membersLoading && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div style={{ width: 32, height: 32, border: '3px solid #F0F1F5', borderTopColor: '#F56B22', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p className="text-[13px] text-[#9CA3B8]">Loading members…</p>
            </div>
          )}
          {!membersLoading && filtered.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F7F8FA] flex items-center justify-center">
                <Search className="w-5 h-5 text-[#9CA3B8]" />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#131C4E]">No members found</p>
                <p className="text-[12px] text-[#9CA3B8] mt-0.5">Try adjusting your search or filters</p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderTop: '1px solid #F0F1F5', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
            <p className="text-[12px] text-[#9CA3B8]">
              Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} {viewBeneficiaries ? 'beneficiaries' : 'members'}
              {filtered.length < sourceList.length && ` (filtered from ${sourceList.length})`}
            </p>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7F1', borderRadius: 8, cursor: safePage === 0 ? 'default' : 'pointer', fontSize: 15, background: '#fff', color: safePage === 0 ? '#D1D5DB' : '#6B7280', transition: 'all 0.15s' }}>‹</button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pg = i;
                  if (totalPages > 7) {
                    if (safePage < 4) pg = i;
                    else if (safePage > totalPages - 5) pg = totalPages - 7 + i;
                    else pg = safePage - 3 + i;
                  }
                  const isActive = pg === safePage;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: isActive ? 'none' : '1px solid #E5E7F1', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500, background: isActive ? 'linear-gradient(135deg,#F56B22,#FF8C4B)' : '#fff', color: isActive ? '#fff' : '#6B7280', boxShadow: isActive ? '0 2px 6px rgba(245,107,34,0.28)' : 'none', transition: 'all 0.15s' }}>{pg + 1}</button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}
                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #E5E7F1', borderRadius: 8, cursor: safePage >= totalPages - 1 ? 'default' : 'pointer', fontSize: 15, background: '#fff', color: safePage >= totalPages - 1 ? '#D1D5DB' : '#6B7280', transition: 'all 0.15s' }}>›</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeMember && (
        <Member360Drawer
          member={activeMember.member}
          index={activeMember.index}
          onClose={() => setActiveMember(null)}
          vis={vis}
          relationshipOptions={relationshipOptions}
          stats={memberStatsMap[activeMember.member.employeeId]}
          maxFamilySize={maxFamilySize}
          schemes={schemes}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          initialMode={showAddModal}
          onClose={() => setShowAddModal(false)}
          relationshipOptions={relationshipOptions}
          schemes={schemes}
          principals={principals}
        />
      )}
    </div>
  );
}
