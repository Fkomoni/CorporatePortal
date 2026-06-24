'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

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

const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: string; IconComponent: React.ComponentType<{ className?: string }> }> = {
  success: { bg: '#ECFDF5', border: '#A7F3D0', icon: '#059669', IconComponent: CheckCircle2 },
  error:   { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', IconComponent: XCircle },
  info:    { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', IconComponent: Info },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const { bg, border, icon, IconComponent } = variantStyles[toast.variant];
  return (
    <div
      className="animate-slide-in flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[280px] max-w-[380px] border"
      style={{ background: bg, borderColor: border }}
    >
      <IconComponent className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: icon }} />
      <p className="flex-1 text-[13px] font-medium text-[#131C4E] leading-snug">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="flex-shrink-0 text-[#9CA3B8] hover:text-[#131C4E] transition-colors">
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
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((t) => <ToastItem key={t.id} toast={t} onRemove={remove} />)}
      </div>
    </ToastContext.Provider>
  );
}
