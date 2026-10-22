import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * Fire once when an element first scrolls into view. Shared by <Reveal> and <FeeBar> so
 * the IntersectionObserver plumbing — and its progressive-enhancement fallbacks — live in
 * one place. Returns `inView: true` immediately (in-effect) when the user prefers reduced
 * motion or IntersectionObserver is unavailable, so callers can treat "in view" as "show
 * the final state now."
 */
export function useInView<T extends Element>(
  options: { threshold?: number; rootMargin?: string } = {},
): { ref: RefObject<T | null>; inView: boolean } {
  const { threshold = 0.15, rootMargin = "0px 0px -10% 0px" } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}
