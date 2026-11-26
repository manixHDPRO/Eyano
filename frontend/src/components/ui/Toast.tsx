import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

export type ToastTone = "error" | "success" | "info";

type ConfirmTone = "danger" | "info";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
};

type ConfirmDialog = {
  tone: ConfirmTone;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (ok: boolean) => void;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ToastContextValue = {
  pushToast: (input: { tone: ToastTone; message: string; title?: string }) => void;
  confirm: (input: ConfirmOptions) => Promise<boolean>;
};

const TOAST_DURATION_MS: Record<ToastTone, number> = {
  success: 4200,
  info: 4800,
  error: 6500,
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const confirmQueueRef = useRef<ConfirmDialog[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ tone, message, title }: { tone: ToastTone; message: string; title?: string }) => {
      const id = createToastId();
      const item: ToastItem = {
        id,
        tone,
        title: title ?? defaultAlertTitle(tone),
        message,
      };
      setToasts((current) => {
        const next = [...current, item];
        if (next.length <= 4) {
          return next;
        }
        const dropped = next.slice(0, next.length - 4);
        for (const old of dropped) {
          const timer = timersRef.current.get(old.id);
          if (timer !== undefined) {
            window.clearTimeout(timer);
            timersRef.current.delete(old.id);
          }
        }
        return next.slice(-4);
      });
      const timer = window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS[tone]);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const settleConfirm = useCallback((ok: boolean) => {
    setConfirmDialog((existing) => {
      if (existing) {
        const resolve = existing.resolve;
        queueMicrotask(() => resolve(ok));
      }
      return confirmQueueRef.current.shift() ?? null;
    });
  }, []);

  const confirm = useCallback(
    ({ title, message, confirmLabel = "Confirmer", cancelLabel = "Annuler", tone = "danger" }: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        const next: ConfirmDialog = {
          tone,
          title,
          message,
          confirmLabel,
          cancelLabel,
          resolve,
        };
        setConfirmDialog((existing) => {
          if (existing) {
            confirmQueueRef.current.push(next);
            return existing;
          }
          return next;
        });
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!confirmDialog) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        settleConfirm(false);
      }
      if (event.key === "Enter") {
        const target = event.target;
        if (target instanceof HTMLButtonElement) {
          return;
        }
        settleConfirm(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmDialog, settleConfirm]);

  const value = useMemo(() => ({ pushToast, confirm }), [confirm, pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-end gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:w-auto sm:p-0"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
          ))}
        </div>,
        document.body,
      )}
      {confirmDialog ? <ConfirmModal dialog={confirmDialog} onDismiss={settleConfirm} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit être utilisé dans ToastProvider.");
  }
  return context;
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const theme = toastTheme(toast.tone);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="eyano-toast pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.45)]"
    >
      <span className={`w-1.5 shrink-0 ${theme.bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-start gap-3 px-3.5 py-3">
        <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${theme.iconWrap}`}>
          <ToastIcon tone={toast.tone} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold tracking-tight text-slate-900">{toast.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fermer"
        >
          <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ dialog, onDismiss }: { dialog: ConfirmDialog; onDismiss: (ok: boolean) => void }) {
  const titleId = "eyano-confirm-title";
  const messageId = "eyano-confirm-message";
  const cancelRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const isDanger = dialog.tone === "danger";

  useEffect(() => {
    const node = isDanger ? cancelRef.current : primaryRef.current;
    node?.focus();
  }, [dialog, isDanger]);

  return createPortal(
    <div className="eyano-dialog-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 cursor-default"
        onClick={() => onDismiss(false)}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="eyano-dialog-panel relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_-20px_rgba(15,23,42,0.55)]"
      >
        <div className="px-6 pb-5 pt-6">
          <div className="flex items-start gap-3">
            {isDanger ? (
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 ring-1 ring-red-100">
                <ConfirmWarningIcon />
              </span>
            ) : (
              <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                <ConfirmInfoIcon />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
                {dialog.title}
              </h2>
              <p id={messageId} className="mt-2 text-[0.9375rem] leading-relaxed text-slate-700">
                {dialog.message}
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button ref={cancelRef} type="button" variant="ghost" onClick={() => onDismiss(false)}>
              {dialog.cancelLabel}
            </Button>
            <Button
              ref={primaryRef}
              type="button"
              variant={isDanger ? "danger" : "primary"}
              onClick={() => onDismiss(true)}
            >
              {dialog.confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ToastIcon({ tone }: { tone: ToastTone }) {
  switch (tone) {
    case "success":
      return (
        <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3.5 8.2 6.4 11l6.1-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "error":
      return (
        <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "info":
      return (
        <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="4.2" r="1.1" fill="currentColor" />
          <path d="M8 7v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default: {
      const unexpected: never = tone;
      return unexpected;
    }
  }
}

function ConfirmWarningIcon() {
  return (
    <svg className="size-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 5.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14.5" r="1.15" fill="currentColor" />
    </svg>
  );
}

function ConfirmInfoIcon() {
  return (
    <svg className="size-5" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="5.5" r="1.2" fill="currentColor" />
      <path d="M10 8.5v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function toastTheme(tone: ToastTone): { bar: string; iconWrap: string } {
  switch (tone) {
    case "success":
      return {
        bar: "bg-teal-600",
        iconWrap: "bg-teal-50 text-teal-700",
      };
    case "error":
      return {
        bar: "bg-red-600",
        iconWrap: "bg-red-50 text-red-700",
      };
    case "info":
      return {
        bar: "bg-sky-600",
        iconWrap: "bg-sky-50 text-sky-800",
      };
    default: {
      const unexpected: never = tone;
      return unexpected;
    }
  }
}

function defaultAlertTitle(tone: ToastTone): string {
  switch (tone) {
    case "success":
      return "Succès";
    case "error":
      return "Erreur";
    case "info":
      return "Information";
    default: {
      const unexpected: never = tone;
      return unexpected;
    }
  }
}

function createToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
