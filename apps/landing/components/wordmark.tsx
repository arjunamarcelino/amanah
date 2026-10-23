import Image from "next/image";
import { cn } from "@amanah/ui/lib/utils";

/**
 * The Amanah brand lockup — the horizontal logo (public/amanah-logo.png, 512×192).
 * Frozen contract: { className? }. Used in the header bar, the footer, and the 404 page.
 * No `priority`: landing serves images unoptimized (output: export), so a preload here
 * would compete with the hero's LCP image for bandwidth at page start.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/amanah-logo.png"
      alt="Amanah"
      width={267}
      height={100}
      className={cn("h-7 w-auto", className)}
    />
  );
}
