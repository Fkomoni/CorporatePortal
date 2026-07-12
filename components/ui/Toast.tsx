'use client';

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
};

const styles = {
  success: { border: '#10B981', icon: '#10B981', bg: '#ECFDF5' },
  error:   { border: '#EF4444', icon: '#EF4444', bg: '#FEF2F2' },
  info:    { border: '#3B82F6', icon: '#3B82F6', bg: '#EFF6FF' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const Icon = icons[toast.variant];
  const s = styles[toast.variant];

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), 3500);
    return () => clearTimeout(t);
  }, [toast.id, onRemove]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-[13px] font-medium text-[#131C4E] min-w-[260px] max-w-[360px] animate-slide-in"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <span className="flex-shrink-0" style={{ color: s.icon }}><Icon className="w-4 h-4" /></span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="text-[#9CA3B8] hover:text-[#131C4E] transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[200]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
