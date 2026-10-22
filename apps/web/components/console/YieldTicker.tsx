"use client";

import { memo, useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatUnits } from "viem";
import { Badge } from "@amanah/ui/badge";

// Presentational leaf (memoized): receives the accrued-yield bigint as a prop and tweens
// the DISPLAY number upward so yield visibly "rises". Only the target is React state; the
// console tree above does not re-render per frame. Reduced-motion snaps to the value.
function toNumber(value: bigint | undefined): number {
  return value === undefined ? 0 : Number(formatUnits(value, 6));
}

export const YieldTicker = memo(function YieldTicker({
  value,
  halalMode,
}: {
  value: bigint | undefined;
  halalMode: boolean | undefined;
}) {
  const reduce = useReducedMotion();
  const target = toNumber(value);
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (reduce) {
      setDisplay(target);
      return;
    }
    const controls = animate(display, target, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [target, reduce]);

  const shown = display.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Yield accrued to the pool
        </span>
        {halalMode ? (
          <Badge variant="secondary" className="gap-1.5">
            <span aria-hidden>🌙</span> Halal mode
          </Badge>
        ) : null}
      </div>
      <div className="font-serif text-4xl tabular-nums tracking-tight text-foreground">
        <span aria-hidden className="mr-1 text-xl text-primary">▲</span>${shown}
      </div>
    </div>
  );
});
