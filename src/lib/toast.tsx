import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
    timers.current.set(id + 0.5, removeTimer);
  }, []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
      const timer = setTimeout(() => dismiss(id), 3000);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const api = useRef<ToastContextType['toast']>({
    success: (message: string) => show('success', message),
    error: (message: string) => show('error', message),
    info: (message: string) => show('info', message),
  });
  api.current.success = (message: string) => show('success', message);
  api.current.error = (message: string) => show('error', message);
  api.current.info = (message: string) => show('info', message);

  return (
    <ToastContext.Provider value={{ toast: api.current }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const bgColor =
            t.type === 'success'
              ? 'bg-[#0037b0]'
              : t.type === 'error'
                ? 'bg-red-600'
                : 'bg-gray-800';
          return (
            <div
              key={t.id}
              className={`
                pointer-events-auto max-w-sm px-4 py-3 text-sm text-white font-medium
                rounded shadow-lg transition-all duration-300 ease-in-out
                ${bgColor}
                ${t.exiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
              `}
              role="alert"
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
