import type { ReactNode } from "react";
import { cn } from "@amanah/ui/lib/utils";

// Translucent pill for overlaying on a cover photo — readable over any image. Shared by the
// live CampaignCard and the showcase ExampleCard (the location/release tags).
export function OverlayBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-foreground/80 px-2.5 py-0.5 text-xs font-medium text-background backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}
