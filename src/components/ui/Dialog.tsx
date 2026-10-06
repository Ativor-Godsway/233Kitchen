import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import FocusTrap from 'focus-trap-react';
import { cn } from '../../lib/cn';

type Variant = 'sheet' | 'drawer-right' | 'center';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible title (visually rendered by children if `hideTitle`). */
  title: string;
  hideTitle?: boolean;
  /**
   * sheet: bottom sheet on mobile, centred modal from `md` up.
   * drawer-right: slide-over from the right (full width on mobile).
   * center: centred modal at all sizes.
   */
  variant?: Variant;
  className?: string;
  children: ReactNode;
  /** Light (admin) or dark (public) surface. */
  tone?: 'light' | 'dark';
}

/** Accessible modal primitive: portal, focus trap, Escape to close, scroll lock. */
export function Dialog({ open, onClose, title, hideTitle, variant = 'sheet', className, children, tone = 'light' }: DialogProps) {
  const titleId = useId();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const panelMotion =
    variant === 'drawer-right'
      ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
      : variant === 'sheet'
        ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
        : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 } };

  return createPortal(
    <AnimatePresence>
      {open && (
        <FocusTrap
          focusTrapOptions={{
            allowOutsideClick: true,
            escapeDeactivates: false,
            fallbackFocus: () => document.getElementById(titleId) ?? document.body,
          }}
        >
          <div
            className={cn(
              'fixed inset-0 z-[60] flex',
              variant === 'sheet' && 'items-end justify-center md:items-center md:p-6',
              variant === 'drawer-right' && 'justify-end',
              variant === 'center' && 'items-center justify-center p-4',
            )}
            role="presentation"
          >
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              {...(reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } } : panelMotion)}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className={cn(
                'relative flex flex-col overflow-hidden shadow-2xl outline-none',
                tone === 'dark' ? 'bg-ink-800 text-cream' : 'bg-white text-neutral-900',
                variant === 'sheet' &&
                  'max-h-[92svh] w-full rounded-t-3xl md:max-h-[88vh] md:w-[min(920px,100%)] md:rounded-3xl',
                variant === 'drawer-right' && 'h-full w-full sm:max-w-md',
                variant === 'center' && 'max-h-[90vh] w-[min(560px,100%)] rounded-2xl',
                className,
              )}
            >
              <h2 id={titleId} tabIndex={-1} className={cn(hideTitle ? 'sr-only' : 'px-6 pb-3 pt-6 text-lg font-semibold outline-none')}>
                {title}
              </h2>
              {children}
            </motion.div>
          </div>
        </FocusTrap>
      )}
    </AnimatePresence>,
    document.body,
  );
}
