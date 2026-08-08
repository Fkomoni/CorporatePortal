'use client';

// Where Leadway staff answer a service request from the link in the email.
//
// Public on purpose: they hold no portal login, and the mail is often forwarded
// to whoever actually owns the answer. The token in the URL is the whole
// authorisation and opens exactly one request, so this page shows that request
// and nothing else: no navigation into the portal, no other tickets, no member
// data.
import { useState, useEffect, use } from 'react';

interface ResponseEntry {
  id: string;
  body: string;
  authorName: string | null;
  status: string;
  createdAt: string;
}

interface RequestView {
  reference: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  raisedBy: string;
  raisedByEmail: string;
  attachmentNames: string[];
  createdAt: string;
  responses: ResponseEntry[];
}

const INK = '#131C4E';
const MUTED = '#6B7480';
const FAINT = '#9CA3B8';

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, border: '1px solid #DEE3ED',
  boxShadow: '0 1px 3px rgba(19,28,78,0.04)',
};
const input: React.CSSProperties = {
  width: '100%', padding: '12px 14px', fontSize: 14, lineHeight: 1.5,
  border: '1.5px solid #E5E7F1', borderRadius: 12, background: '#FAFBFC',
  color: INK, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: FAINT,
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7, display: 'block',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export default function RespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [request, setRequest] = useState<RequestView | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'Responded' | 'Resolved'>('Responded');
  const [responderName, setResponderName] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  // What was just sent, or null. A resolution ends the page; a response is
  // acknowledged but the responder can add another without reloading the link.
  const [justSent, setJustSent] = useState<'Responded' | 'Resolved' | null>(null);

  // One fetch on mount to load the request this link opens.
  useEffect(() => {
    fetch(`/api/service-desk/respond?token=${encodeURIComponent(token)}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (body.request) setRequest(body.request);
        if (!ok) setLoadError(body.error ?? 'This link is not valid.');
      })
      .catch(() => setLoadError('Could not load this request. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function send() {
    if (!response.trim()) { setSendError('Please write a response before sending.'); return; }
    setSending(true); setSendError('');
    try {
      const res = await fetch('/api/service-desk/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, response, status, responderName }),
      });
      const body = await res.json();
      if (!res.ok) { setSendError(body.error ?? 'Could not send your response.'); return; }
      setRequest(body.request);
      setJustSent(status);
      setResponse('');
    } catch {
      setSendError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FC', padding: '40px 20px', fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F56B22' }}>
            Leadway Health · Corporate Portal
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, letterSpacing: '-0.02em', marginTop: 6 }}>
            Respond to a service request
          </h1>
        </div>

        {loading && (
          <div style={{ ...card, padding: '28px 24px' }}>
            <p style={{ fontSize: 14, color: MUTED }}>Loading...</p>
          </div>
        )}

        {!loading && loadError && !request && (
          <div style={{ ...card, padding: '28px 24px', borderColor: '#FECACA', background: '#FEF2F2' }}>
            <p style={{ fontSize: 14, color: '#B91C1C', lineHeight: 1.6 }}>{loadError}</p>
          </div>
        )}

        {request && (
          <>
            {/* The request itself, so the responder has the context without
                needing the original email in front of them. */}
            <div style={{ ...card, padding: '24px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: 'ui-monospace,monospace' }}>{request.reference}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', background: '#FFF7ED', borderRadius: 99, padding: '3px 10px' }}>{request.category}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '3px 10px',
                  color: request.status === 'Resolved' ? '#059669' : request.status === 'Responded' ? '#2563EB' : '#D97706',
                  background: request.status === 'Resolved' ? '#ECFDF5' : request.status === 'Responded' ? '#EFF6FF' : '#FFFBEB',
                }}>{request.status}</span>
              </div>

              <p style={{ fontSize: 17, fontWeight: 700, color: INK, lineHeight: 1.4 }}>{request.subject}</p>
              <p style={{ fontSize: 12.5, color: FAINT, marginTop: 6 }}>
                Raised by {request.raisedBy} · {fmt(request.createdAt)}
              </p>

              {request.description && (
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, marginTop: 16, whiteSpace: 'pre-wrap' }}>
                  {request.description}
                </p>
              )}

              {request.attachmentNames.length > 0 && (
                <p style={{ fontSize: 12, color: FAINT, marginTop: 14 }}>
                  Attachments on the original email: {request.attachmentNames.join(', ')}
                </p>
              )}
            </div>

            {/* Everything said so far, oldest first. Shown whether or not the
                link still works, so a second reader sees the exchange rather
                than an empty form or a bare error, and so whoever picks the
                request up next can see what has already been answered. */}
            {request.responses.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ ...label, marginBottom: 10 }}>
                  {request.responses.length === 1 ? 'Reply sent' : `${request.responses.length} replies sent`}
                </p>
                {request.responses.map((r) => (
                  <div key={r.id} style={{
                    ...card, padding: '18px 20px', marginBottom: 10,
                    borderColor: r.status === 'Resolved' ? '#A7F3D0' : '#BFDBFE',
                    background: r.status === 'Resolved' ? '#F0FDF4' : '#F5F9FF',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 9 }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '2px 9px',
                        color: r.status === 'Resolved' ? '#059669' : '#2563EB',
                        background: r.status === 'Resolved' ? '#DCFCE7' : '#DBEAFE',
                      }}>{r.status}</span>
                      <span style={{ fontSize: 12, color: r.status === 'Resolved' ? '#059669' : '#3B6FB8' }}>
                        {r.authorName ? `${r.authorName} · ` : ''}{fmt(r.createdAt)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                      color: r.status === 'Resolved' ? '#065F46' : '#1E3A5F',
                    }}>{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            {justSent && (
              <div style={{ ...card, padding: '22px 24px', marginBottom: 18, borderColor: '#A7F3D0', background: '#ECFDF5' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>Sent to {request.raisedBy}.</p>
                <p style={{ fontSize: 13, color: '#047857', lineHeight: 1.6, marginTop: 6 }}>
                  {justSent === 'Resolved'
                    ? `${request.reference} is resolved and closed in their Corporate Portal. This link has now been retired, so you can close this page.`
                    : `It is on ${request.reference} in their Corporate Portal now. This link stays live, so you can come back and add to it, or resolve the request once it is finished.`}
                </p>
              </div>
            )}

            {/* Resolving retires the link, so the form goes with it. After a
                response it stays: the same link is how the follow-up and the
                eventual resolution are sent. */}
            {justSent !== 'Resolved' && !loadError && (
              <div style={{ ...card, padding: '24px' }}>
                <div style={{ marginBottom: 18 }}>
                  <label style={label} htmlFor="response">
                    {request.responses.length > 0 ? 'Add another response' : 'Your response'}
                  </label>
                  <textarea
                    id="response" value={response}
                    onChange={(e) => { setResponse(e.target.value); setJustSent(null); }}
                    rows={7} placeholder="What has been done, or what you need from them..."
                    style={{ ...input, resize: 'vertical' }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }}
                  />
                  <p style={{ fontSize: 11.5, color: FAINT, marginTop: 6 }}>
                    This is shown to the HR team on their ticket, so write it for them.
                  </p>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <span style={label}>Is this the full answer?</span>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {([
                      { key: 'Responded' as const, title: 'Responded', sub: 'More to do. The link stays live for a follow-up.' },
                      { key: 'Resolved' as const, title: 'Resolved', sub: 'Finished. This closes the request and retires the link.' },
                    ]).map((o) => (
                      <button key={o.key} type="button" onClick={() => setStatus(o.key)}
                        style={{
                          flex: '1 1 240px', textAlign: 'left', padding: '13px 15px', borderRadius: 12, cursor: 'pointer',
                          border: `1.5px solid ${status === o.key ? '#F56B22' : '#E5E7F1'}`,
                          background: status === o.key ? '#FFF5EF' : '#fff',
                        }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: status === o.key ? '#C2410C' : INK }}>{o.title}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>{o.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={label} htmlFor="who">Your name <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(optional)</span></label>
                  <input id="who" value={responderName} onChange={(e) => setResponderName(e.target.value)}
                    placeholder="So HR knows who answered" style={input}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#F56B22'; e.currentTarget.style.background = '#fff'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7F1'; e.currentTarget.style.background = '#FAFBFC'; }} />
                </div>

                {sendError && (
                  <div style={{ fontSize: 13, padding: '11px 14px', borderRadius: 10, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', marginBottom: 16, lineHeight: 1.5 }}>
                    {sendError}
                  </div>
                )}

                <button onClick={send} disabled={sending || !response.trim()}
                  style={{
                    height: 46, padding: '0 28px', fontSize: 14, fontWeight: 700, color: '#fff', border: 'none',
                    borderRadius: 24, cursor: sending ? 'wait' : !response.trim() ? 'not-allowed' : 'pointer',
                    opacity: !response.trim() ? 0.5 : 1,
                    background: 'linear-gradient(135deg,#F56B22,#FF8C4B)', boxShadow: '0 2px 10px rgba(245,107,34,0.32)',
                  }}>
                  {sending ? 'Sending...' : status === 'Resolved' ? 'Send and resolve' : 'Send response'}
                </button>
              </div>
            )}

            {loadError && request && (
              <div style={{ ...card, padding: '20px 24px', borderColor: '#FDE68A', background: '#FFFBEB' }}>
                <p style={{ fontSize: 13.5, color: '#78350F', lineHeight: 1.6 }}>{loadError}</p>
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: 11.5, color: FAINT, textAlign: 'center', marginTop: 26, lineHeight: 1.6 }}>
          This link opens one request and nothing else. It expires 30 days after the request was raised.
        </p>
      </div>
    </div>
  );
}
