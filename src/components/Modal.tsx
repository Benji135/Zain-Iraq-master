"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[min(1200px,95vw)]",
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Tracks how many modals are open so nested/stacked dialogs don't fight over
 * the body scroll lock — only the last one to close restores scrolling.
 */
let lockCount = 0;

function lockScroll() {
  if (lockCount === 0) {
    const width = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (width > 0) document.body.style.paddingRight = `${width}px`;
  }
  lockCount += 1;
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Small muted line under the title. */
  subtitle?: React.ReactNode;
  /** Rendered right of the title, before the close button. */
  headerAccessory?: React.ReactNode;
  /** Pinned footer; typically action buttons. */
  footer?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  /** Set false for destructive flows where a stray backdrop click would lose work. */
  closeOnBackdrop?: boolean;
  /** Hide the default header entirely (caller supplies its own chrome). */
  bare?: boolean;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerAccessory,
  footer,
  size = "lg",
  children,
  closeOnBackdrop = true,
  bare = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => setMounted(true), []);

  // Remember the trigger so focus can go back where the user left it.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      const el = restoreFocusRef.current;
      // Only restore if the trigger is still in the document.
      if (el && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    return unlockScroll;
  }, [open]);

  // Entrance transition — one frame after mount so the transition actually runs.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Move focus into the dialog once it's on screen.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Escape to close, Tab cycles within the dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 sm:p-6 md:p-10"
      role="presentation"
    >
      <div
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
        className={`fixed inset-0 bg-zinc-950/50 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? descId : undefined}
        tabIndex={-1}
        className={`relative my-auto w-full ${SIZES[size]} rounded-2xl bg-white shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] ring-1 ring-zinc-950/5 outline-none transition-all duration-200 ease-out motion-reduce:transition-none ${
          entered ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-[0.98]"
        }`}
      >
        {!bare && (
          <header className="flex items-start gap-4 border-b border-zinc-150 px-6 py-5">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-base font-bold text-zinc-950">
                {title}
              </h2>
              {subtitle && (
                <p id={descId} className="mt-1 truncate text-xs font-medium text-zinc-500">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAccessory}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-1.5 -mt-1 shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>
        )}

        <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2.5 border-t border-zinc-150 bg-zinc-50/70 px-6 py-4 rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Confirmation dialogs — a promise-based replacement for window.confirm */
/* ------------------------------------------------------------------ */

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in red and focuses Cancel by default. */
  destructive?: boolean;
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type PendingConfirm = ConfirmOptions & { resolve: (v: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  const settle = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result);
        return null;
      });
    },
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ""}
        size="sm"
        closeOnBackdrop={false}
        footer={
          <>
            <button
              type="button"
              data-autofocus={pending?.destructive ? "" : undefined}
              onClick={() => settle(false)}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              {pending?.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              data-autofocus={pending?.destructive ? undefined : ""}
              onClick={() => settle(true)}
              className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                pending?.destructive
                  ? "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
                  : "bg-zinc-900 hover:bg-zinc-800 focus-visible:outline-zinc-900"
              }`}
            >
              {pending?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-zinc-600">{pending?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
