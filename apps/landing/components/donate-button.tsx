import { siteConfig } from "@/lib/site";
import { Button } from "@amanah/ui/button";
import { cn } from "@amanah/ui/lib/utils";

/**
 * The primary "Donate Now →" CTA into the dApp — a pine pill that lifts on hover with an arrow
 * that nudges right. Shared by the hero and the closing CTA so the two never drift.
 */
export function DonateButton({ className }: { className?: string }) {
  return (
    <Button
      asChild
      size="lg"
      className={cn(
        "group h-12 rounded-full px-9 text-base transition-transform duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <a href={siteConfig.appUrl}>
        Donate Now
        <span
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-1"
        >
          →
        </span>
      </a>
    </Button>
  );
}
