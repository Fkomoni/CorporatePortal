'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, AlertCircle, Upload } from 'lucide-react';

interface ListItem { text: string; value: string; }

interface InvitationMeta {
  email: string;
  employeeCode: string;
  schemeId: string;
  schemeName: string;
  scope: string;
  inviteType: string;
  parentCif?: string;
  maxDependents: number;
  usedCount: number;
  remainingSlots: number;
  expiresAt: string;
}


const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px', fontSize: 14,
  border: '1.5px solid #E5E7F1', borderRadius: 10, background: '#FAFBFC',
  color: '#131C4E', outline: 'none', boxSizing: 'border-box',
};

export default function EnrollPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus]           = useState<'loading' | 'ready' | 'invalid' | 'expired' | 'used' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg]       = useState('');
  const [invitation, setInvitation]   = useState<InvitationMeta | null>(null);
  const [genders, setGenders]         = useState<ListItem[]>([]);
  const [maritalStatuses, setMarital] = useState<ListItem[]>([]);
  const [states, setStates]           = useState<ListItem[]>([]);
  const [relationships, setRelationships] = useState<ListItem[]>([]);
  const [submitting, setSubmitting]   = useState(false);
  const [enrollResult, setEnrollResult] = useState<{ enrolleeId: string; membershipNo: string } | null>(null);
  const [depEnrolled, setDepEnrolled] = useState<Array<{ enrolleeId: string; name: string }>>([]);
  const [remainingSlots, setRemainingSlots] = useState(1);

  // Form fields
  const [firstName, setFirstName]         = useState('');
  const [surname, setSurname]             = useState('');
  const [otherNames, setOtherNames]       = useState('');
  const [dateOfBirth, setDob]             = useState('');
  const [sexId, setSexId]                 = useState('');
  const [maritalStatus, setMarital2]      = useState('');
  const [mobile, setMobile]               = useState('');
  const [mobile2, setMobile2]             = useState('');
  const [postalTownId, setStateId]        = useState('');
  const [address, setAddress]             = useState('');
  const [preExisting, setPreExisting]     = useState('');
  const [relationshipId, setRelationship] = useState('');
  const [depEmail, setDepEmail]           = useState('');
  const [photoBase64, setPhoto]           = useState('');
  const [photoType, setPhotoType]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/enroll/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          if (d.error.includes('already been used')) { setStatus('used'); return; }
          if (d.error.includes('expired')) { setStatus('expired'); return; }
          setStatus('invalid'); setErrorMsg(d.error); return;
        }
        setInvitation(d.invitation);
        setGenders(d.genders ?? []);
        setMarital(d.maritalStatuses ?? []);
        setStates(d.states ?? []);
        setRelationships(d.relationships ?? []);
        setRemainingSlots(d.invitation?.remainingSlots ?? 1);
        setStatus('ready');
      })
      .catch(() => { setStatus('invalid'); setErrorMsg('Failed to load enrolment form. Please try again.'); });
  }, [token]);

  const isDependent = invitation?.inviteType === 'dependent';

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeMatch = header.match(/data:([^;]+);/);
      setPhoto(base64 ?? '');
      setPhotoType(mimeMatch?.[1] ?? file.type);
    };
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setFirstName(''); setSurname(''); setOtherNames(''); setDob('');
    setSexId(''); setMarital2(''); setMobile(''); setMobile2('');
    setStateId(''); setAddress(''); setPreExisting(''); setRelationship('');
    setDepEmail(''); setPhoto(''); setPhotoType('');
    setErrorMsg(''); setStatus('ready');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invitation) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/enroll/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: isDependent ? (depEmail || invitation.email) : invitation.email,
          employeeCode: invitation.employeeCode,
          firstName, surname, otherNames, dateOfBirth, sexId,
          maritalStatus, mobile, mobile2, postalTownId, address,
          relationshipId,
          preExistingCondition: preExisting || 'None',
          enrolleePicture: photoBase64,
          enrolleePictureType: photoType,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? 'Enrolment failed. Please try again.');
        setStatus('error');
      } else {
        const enrolleeId = data.enrolleeId ?? '';
        const name = `${firstName} ${surname}`.trim();
        if (isDependent) {
          setDepEnrolled(prev => [...prev, { enrolleeId, name }]);
          setRemainingSlots(prev => Math.max(0, prev - 1));
          setEnrollResult({ enrolleeId, membershipNo: data.membershipNo ?? '' });
          setStatus('success');
        } else {
          setEnrollResult({ enrolleeId, membershipNo: data.membershipNo ?? '' });
          setStatus('success');
        }
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #F56B22', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6B7280', fontSize: 14 }}>Loading your enrolment form…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === 'used') {
    return <StatusScreen icon="check" color="#059669" bg="#ECFDF5" title="Already Enrolled" message="This enrolment link has already been used. If you need to update your details, please contact your HR team." />;
  }
  if (status === 'expired') {
    return <StatusScreen icon="alert" color="#D97706" bg="#FFFBEB" title="Link Expired" message="This enrolment link has expired (links are valid for 7 days). Please ask your HR team to send a new link." />;
  }
  if (status === 'invalid') {
    return <StatusScreen icon="alert" color="#DC2626" bg="#FEF2F2" title="Invalid Link" message={errorMsg || 'This enrolment link is not valid. Please contact your HR team.'} />;
  }
  if (status === 'success') {
    const memberId = enrollResult?.enrolleeId || enrollResult?.membershipNo || '';
    const canAddMore = isDependent && remainingSlots > 0;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FC', padding: 24 }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle style={{ width: 36, height: 36, color: '#059669' }} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: '#131C4E', marginBottom: 10 }}>
            {isDependent ? 'Dependent Enrolled!' : 'Enrolment Successful!'}
          </p>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>
            {isDependent
              ? `${enrollResult ? `${firstName} ${surname}`.trim() || 'Dependent' : 'Dependent'} has been successfully enrolled on `
              : 'You have been successfully enrolled on '}
            <strong>{invitation?.schemeName ?? 'your health plan'}</strong>.
            {!isDependent && ' Keep your member ID safe — you will need it when visiting any Leadway Health provider.'}
          </p>

          {/* Previously enrolled dependents */}
          {isDependent && depEnrolled.length > 1 && (
            <div style={{ background: '#fff', border: '1px solid #EDEEF2', borderRadius: 16, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Enrolled Dependents</p>
              {depEnrolled.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{d.name || `Dependent ${i + 1}`}</span>
                  <span style={{ fontSize: 13, color: '#059669', fontFamily: 'monospace', fontWeight: 700 }}>{d.enrolleeId}</span>
                </div>
              ))}
            </div>
          )}

          {memberId && (
            <div style={{ background: '#fff', border: '1.5px solid #BBF7D0', borderRadius: 20, padding: '28px 32px', marginBottom: 24, boxShadow: '0 4px 24px rgba(16,185,129,0.10)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                {isDependent ? 'Enrolee ID' : 'Your Member ID'}
              </p>
              <p style={{ fontSize: 36, fontWeight: 900, color: '#131C4E', letterSpacing: '0.04em', fontFamily: 'monospace', marginBottom: 12 }}>{memberId}</p>
              <button
                onClick={() => { try { navigator.clipboard.writeText(memberId); } catch { const t = document.createElement('textarea'); t.value = memberId; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } }}
                style={{ marginTop: 16, height: 38, padding: '0 20px', fontSize: 13, fontWeight: 700, color: '#059669', border: '1.5px solid #BBF7D0', borderRadius: 10, background: '#ECFDF5', cursor: 'pointer' }}>
                Copy ID
              </button>
            </div>
          )}

          {canAddMore && (
            <button
              onClick={resetForm}
              style={{ width: '100%', height: 48, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, boxShadow: '0 4px 16px rgba(245,107,34,0.35)' }}>
              Enrol Another Dependent
            </button>
          )}

          <p style={{ fontSize: 13, color: '#9CA3B8' }}>
            {isDependent
              ? 'The HR team will be notified of this enrolment.'
              : 'Your HR team will follow up with your physical member card and further details.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FC', padding: '40px 16px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', borderRadius: 20, padding: '28px 32px', marginBottom: 28, color: '#fff' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>
            {isDependent ? 'Dependent Enrolment' : 'Health Insurance Enrolment'}
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{invitation?.schemeName}</p>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            {isDependent
              ? 'Complete the form below to enrol a dependent on this health plan.'
              : `Complete the form below to enrol. Your email (${invitation?.email}) and employee code are pre-verified.`}
          </p>
        </div>

        {/* Previously enrolled list for dependent flow */}
        {isDependent && depEnrolled.length > 0 && (
          <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 8 }}>Already enrolled in this session:</p>
            {depEnrolled.map((d, i) => (
              <p key={i} style={{ fontSize: 13, color: '#065F46', margin: '2px 0' }}>
                {d.name || `Dependent ${i + 1}`} — <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{d.enrolleeId}</span>
              </p>
            ))}
          </div>
        )}

        {status === 'error' && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 18px', marginBottom: 20, color: '#DC2626', fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Photo */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '24px 28px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Passport Photo</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: 16, background: '#F7F8FC', border: '2px dashed #E5E7F1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {photoBase64
                  ? <img src={`data:${photoType};base64,${photoBase64}`} alt="passport" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Upload style={{ width: 24, height: 24, color: '#C4C9D9' }} />}
              </div>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  style={{ height: 36, padding: '0 16px', fontSize: 13, fontWeight: 600, color: '#F56B22', border: '1.5px solid #FFD8C0', borderRadius: 10, background: '#FFF5EF', cursor: 'pointer' }}>
                  {photoBase64 ? 'Change Photo' : 'Upload Photo'}
                </button>
                <p style={{ fontSize: 11, color: '#9CA3B8', marginTop: 6 }}>JPG or PNG, max 2 MB</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handlePhoto} />
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '24px 28px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Personal Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="First Name *" value={firstName} onChange={setFirstName} placeholder="e.g. Amaka" required />
              <Field label="Surname *" value={surname} onChange={setSurname} placeholder="e.g. Okafor" required />
              <Field label="Other Names" value={otherNames} onChange={setOtherNames} placeholder="Middle name(s)" />
              <Field label="Date of Birth *" value={dateOfBirth} onChange={setDob} type="date" required />
              <SelectField label="Gender *" value={sexId} onChange={setSexId} required>
                <option value="">Select gender</option>
                {genders.map((g) => <option key={g.value} value={g.value}>{g.text}</option>)}
              </SelectField>
              <SelectField label="Marital Status" value={maritalStatus} onChange={setMarital2}>
                <option value="">Select status</option>
                {maritalStatuses.map((m) => <option key={m.value} value={m.value}>{m.text}</option>)}
              </SelectField>
              {isDependent && (
                <SelectField label="Relationship to Principal *" value={relationshipId} onChange={setRelationship} required>
                  <option value="">Select relationship</option>
                  {relationships.map((r) => <option key={r.value} value={r.value}>{r.text}</option>)}
                </SelectField>
              )}
              {isDependent && (
                <Field label="Dependent's Email" value={depEmail} onChange={setDepEmail} type="email" placeholder="e.g. amaka@gmail.com" />
              )}
            </div>
          </div>

          {/* Contact Details */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '24px 28px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Contact Details</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Mobile Number *" value={mobile} onChange={setMobile} placeholder="e.g. 08012345678" type="tel" required />
              <Field label="Alternative Mobile" value={mobile2} onChange={setMobile2} placeholder="e.g. 07012345678" type="tel" />
              <SelectField label="State of Residence *" value={postalTownId} onChange={setStateId} required>
                <option value="">Select state</option>
                {states.map((s) => <option key={s.value} value={s.value}>{s.text}</option>)}
              </SelectField>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Home Address" value={address} onChange={setAddress} placeholder="e.g. 12 Adeola Odeku Street, Victoria Island" />
              </div>
            </div>
          </div>

          {/* Medical */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #EDEEF2', padding: '24px 28px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B0B7C9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Medical Information</p>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Pre-existing Conditions</p>
              <textarea
                value={preExisting}
                onChange={(e) => setPreExisting(e.target.value)}
                placeholder="List any pre-existing medical conditions, or leave blank if none"
                rows={3}
                style={{ ...inputStyle, height: 'auto', padding: '10px 14px', resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting}
            style={{ height: 52, borderRadius: 14, border: 'none', background: submitting ? '#F0F1F5' : 'linear-gradient(135deg,#F56B22,#FF8C4B)', color: submitting ? '#B0B7C9' : '#fff', fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 4px 16px rgba(245,107,34,0.35)', transition: 'all 0.15s' }}>
            {submitting ? 'Submitting…' : 'Submit Enrolment'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3B8', marginTop: -12 }}>
            Your information is encrypted and securely transmitted to Leadway Health.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</p>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required}
        style={inputStyle}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, required, children }: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</p>
      <select value={value} onChange={(e) => onChange(e.target.value)} required={required}
        style={{ ...inputStyle, appearance: 'none', cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B8BFD0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
        {children}
      </select>
    </div>
  );
}

function StatusScreen({ icon, color, bg, title, message }: { icon: 'check' | 'alert'; color: string; bg: string; title: string; message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F8FC', padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          {icon === 'check'
            ? <CheckCircle style={{ width: 36, height: 36, color }} />
            : <AlertCircle style={{ width: 36, height: 36, color }} />}
        </div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#131C4E', marginBottom: 12 }}>{title}</p>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  );
}
