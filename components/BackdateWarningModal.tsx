'use client';

// Shown whenever HR sets a cover start / approval effective date in the past.
// Backdating itself is allowed (an invitation issued for 1 July must still take
// effect on 1 July even if HR only approves it in August): this modal is the
// liability gate HR has to pass first, and the acknowledgement is sent to the
// server as `backdateAcknowledged`.
export function BackdateWarningModal({ onAgree, onCancel }: { onAgree: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,17,33,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, maxWidth: 480, width: '100%', padding: '28px 28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: '#DC2626', marginBottom: 12 }}>WARNING: BACKDATED ENROLMENT</p>
        <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7, marginBottom: 20 }}>
          Backdating a member&apos;s enrolment does <strong>NOT</strong> make any medical expenses incurred before the actual enrolment date eligible for reimbursement or approval.
          Leadway HMO will not refund or settle any claims, treatments, admissions, or medications obtained prior to the member&apos;s valid enrolment date.
          Please proceed only if you understand and accept these conditions.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1.5px solid #E5E7F1', background: '#fff', color: '#6B7280', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onAgree} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
            I Understand, Agree &amp; Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
