'use client';

import { AlertTriangle } from 'lucide-react';

// Shown when a page couldn't load its data. Without this, a failed fetch leaves
// the page rendering zeros and empty tables, which reads as "there is no data"
// rather than "we couldn't reach the server" — and HR can act on the wrong
// numbers. Pair with a retry so the user isn't stuck reloading the whole app.
export function LoadErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
    }}>
      <AlertTriangle style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0 }} />
      <p style={{ fontSize: 13, color: '#DC2626', flex: 1 }}>{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          style={{ height: 32, padding: '0 14px', fontSize: 12.5, fontWeight: 700, color: '#DC2626', background: '#fff', border: '1px solid #FECACA', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
          Retry
        </button>
      )}
    </div>
  );
}
