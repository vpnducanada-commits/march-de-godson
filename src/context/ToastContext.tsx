import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (type: ToastType, message: string) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => undefined });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span className="toast__icon">
              <Icon name={t.type === 'success' ? 'check-circle' : t.type === 'error' ? 'alert' : 'info'} size={18} />
            </span>
            <span className="toast__msg">{t.message}</span>
            <button
              type="button"
              className="toast__close"
              aria-label="Fermer la notification"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
