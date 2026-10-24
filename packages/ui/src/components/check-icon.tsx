import type { SVGProps } from "react";
import { cn } from "../lib/utils";

// Shared checkmark line icon (viewBox 0 0 24 24, 2.5 stroke, rounded caps/joins, no fill).
// stroke is currentColor so it inherits the adjacent text color; pass className to size/tint
// (defaults to size-4). Deduplicates the hand-copied <svg> in the stepper, dialogs, and menus.
export function CheckIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4", className)}
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
