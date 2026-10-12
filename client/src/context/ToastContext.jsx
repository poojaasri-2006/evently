import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const TOAST_COLORS = {
  success: 'var(--success-sage)',
  error: '#b91c1c',
  info: 'var(--primary-rose)',
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}

      {/* Toast container */}
      <div
        style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: 'min(92vw, 380px)',
          pointerEvents: 'none',
        }}
      >
        <style>{`
          @keyframes toastSlideIn {
            from { opacity: 0; transform: translateX(40px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes toastFadeOut {
            from { opacity: 1; }
            to { opacity: 0; transform: translateX(40px); }
          }
        `}</style>
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type] || Info;
          const color = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                backgroundColor: 'var(--card-white, #fff)',
                borderRadius: 'var(--radius-normal, 14px)',
                padding: '1rem 1.25rem',
                boxShadow: '0 12px 32px rgba(90, 55, 60, 0.18)',
                borderLeft: `4px solid ${color}`,
                animation: 'toastSlideIn 0.3s ease',
                fontFamily: "var(--font-family, 'Poppins', sans-serif)",
              }}
            >
              <Icon size={20} color={color} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary, #3b3335)', lineHeight: 1.5 }}>
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: 'var(--text-secondary, #9a8f91)',
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
