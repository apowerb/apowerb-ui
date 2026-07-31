import { useEffect, useRef } from "react";

export function useFocusTrap(isOpen) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelectors = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const previouslyFocused = document.activeElement;

    // Focus the modal container itself (not the first focusable child) so
    // Tab/Shift+Tab still work while avoiding the stolen-click bug: a
    // deferred ``firstFocusable.focus()`` used to fire 50ms after open,
    // which could land right as the user was clicking a template card,
    // eating the click and forcing a second one.
    if (!container.contains(document.activeElement)) {
      if (!container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      container.focus({ preventScroll: true });
    }

    function handleKeyDown(e) {
      if (e.key !== "Tab") return;

      const focusableElements = container.querySelectorAll(focusableSelectors);
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  return containerRef;
}
