"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/use-in-view";

/**
 * Counts a number up from 0 → `value` once it scrolls into view (easeOutCubic). Respects
 * reduced motion (snaps to the final value). `format` turns the running number into display
 * text; default is a locale integer. The element is inline so it drops into any sentence.
 */
export function CountUp({
  value,
  duration = 1500,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(value);
      return;
    }

    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const text = format ? format(n) : Math.round(n).toLocaleString();
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
