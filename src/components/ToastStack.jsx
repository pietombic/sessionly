import { useEffect } from 'react';

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4200);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div className={`app-toast app-toast--${toast.type || 'info'}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className="app-toast-icon" aria-hidden="true">
        {toast.type === 'error' ? '!' : toast.type === 'success' ? '✓' : 'i'}
      </span>
      <span>{toast.message}</span>
      <button onClick={() => onDismiss(toast.id)} aria-label="Chiudi notifica">×</button>
    </div>
  );
}

export function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />)}
    </div>
  );
}
