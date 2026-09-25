import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogEntry {
  container: HTMLElement | null;
  onClose: () => void;
}

let dialogStack: DialogEntry[] = [];

export interface UseDialogA11yOptions {
  onClose: () => void;
  enabled?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  lockScroll?: boolean;
  restoreFocus?: boolean;
}

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>({
  onClose,
  enabled = true,
  initialFocusRef,
  lockScroll = true,
  restoreFocus = true,
}: UseDialogA11yOptions) {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    const previouslyFocused =
      restoreFocus && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const prevOverflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = "hidden";

    const entry: DialogEntry = {
      container,
      onClose: () => onCloseRef.current(),
    };
    dialogStack.push(entry);

    const isTopmost = () =>
      dialogStack[dialogStack.length - 1] === entry;

    const initialFocus =
      initialFocusRef?.current ??
      container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      null;
    initialFocus?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !container) return;
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKey);
      const index = dialogStack.indexOf(entry);
      if (index !== -1) dialogStack.splice(index, 1);
      previouslyFocused?.focus?.();
    };
  }, [enabled, initialFocusRef, lockScroll, restoreFocus]);

  return containerRef;
}