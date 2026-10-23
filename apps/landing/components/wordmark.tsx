import Image from "next/image";
import { cn } from "@amanah/ui/lib/utils";

/**
 * The Amanah brand lockup — the horizontal logo (public/amanah-logo.png, 2048×768).
 * Frozen contract: { className? }. Used in the header bar, the footer, and the 404 page.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/amanah-logo.png"
      alt="Amanah"
      width={267}
      height={100}
      priority
      className={cn("h-7 w-auto", className)}
    />
  );
}
