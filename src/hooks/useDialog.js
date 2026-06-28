import { useCallback, useEffect, useRef, useState } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialog(onClose, { focusOnOpen = true } = {}) {
  const [dialog, setDialog] = useState(null);
  const dialogRef = useCallback((node) => setDialog(node), []);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (focusOnOpen) {
      window.requestAnimationFrame(() => {
        const preferred = dialog.querySelector('[autofocus]') || dialog.querySelector(FOCUSABLE);
        preferred?.focus();
      });
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)]
        .filter((element) =>
          !element.hidden
          && element.getAttribute('aria-hidden') !== 'true'
          && element.getClientRects().length > 0
        );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [dialog, focusOnOpen]);

  return dialogRef;
}
