import { cn } from "@amanah/ui/lib/utils";

/**
 * The Amanah wordmark — Fraunces with a pine terminal dot. Frozen contract: { className? }.
 * Used in the header bar and the footer; not a logo asset.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-serif text-[1.375rem] font-semibold tracking-tight text-primary",
        className,
      )}
    >
      Amanah
      <span aria-hidden="true" className="ml-1 inline-block size-[0.3em] rounded-full bg-primary" />
    </span>
  );
}
