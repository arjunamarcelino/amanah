import type { ReactNode, SVGProps } from "react";
import { cn } from "@amanah/ui/lib/utils";

/**
 * Shared stroke-icon wrapper — one place for the SVG attrs every inline icon repeats
 * (viewBox, fill:none, stroke:currentColor, round caps/joins, aria-hidden). Callers pass the
 * paths as children and override `className` (size) / `strokeWidth` as needed.
 */
export function StrokeIcon({
  children,
  className,
  strokeWidth = 1.8,
  ...rest
}: { children: ReactNode; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Canonical heart-in-hand "give/donate" glyph — shared by the header menu and How-it-works. */
export function DonateGlyph() {
  return (
    <>
      <path d="M3 14a2 2 0 0 1 2-2h3l2.3 1.5a2 2 0 0 0 2.2 0L17 10a1.6 1.6 0 1 1 2 2.5l-5 4a3 3 0 0 1-3 .5l-3-1" />
      <path d="M14.5 3.5a2.1 2.1 0 0 0-2.5.4l-.5.5-.5-.5A2.1 2.1 0 1 0 8 7.3l3.5 3.2 3.5-3.2a2.1 2.1 0 0 0-.5-3.8Z" />
    </>
  );
}
