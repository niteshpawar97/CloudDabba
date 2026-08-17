import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { subscribeToastBus } from './toastBus';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  exiting?: boolean;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const STYLES = {
  success: { border: 'border-green-500/30', icon: 'text-green-400', glow: 'rgba(34,197,94,0.15)' },
  error: { border: 'border-red-500/30', icon: 'text-red-400', glow: 'rgba(239,68,68,0.15)' },
  info: { border: 'border-blue-500/30', icon: 'text-blue-400', glow: 'rgba(59,130,246,0.15)' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const style = STYLES[toast.type];
  const Icon = ICONS[toast.type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-[#141820] border ${style.border} text-sm text-slate-200 min-w-[280px] max-w-[400px] ${
        toast.exiting ? 'animate-slide-out' : 'animate-slide-in'
      }`}
      style={{
        boxShadow: `4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02), 0 0 20px ${style.glow}`,
      }}
    >
      <Icon className={`h-5 w-5 shrink-0 ${style.icon}`} />
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="text-slate-500 hover:text-slate-300 shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const contextValue = useRef({
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
  });

  // Update ref when addToast changes
  useEffect(() => {
    contextValue.current = {
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      info: (msg: string) => addToast('info', msg),
    };
  }, [addToast]);

  // Let non-component code (e.g. the axios interceptor) show a toast
  useEffect(() => subscribeToastBus(addToast), [addToast]);

  return (
    <ToastContext.Provider value={contextValue.current}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
