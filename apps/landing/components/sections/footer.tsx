import { Wordmark } from "@/components/wordmark";

export function Footer() {
  return (
    <footer className="border-t border-border/70 py-12">
      <div className="mx-auto max-w-[69rem] px-[clamp(1.25rem,5vw,3rem)]">
        <Wordmark />
        <p className="mt-3 max-w-[38rem] text-sm text-muted-foreground">
          Give once. Protect many. Lose nothing to the middle.
        </p>
        <p className="mt-8 text-xs text-muted-foreground">© 2026 Amanah</p>
      </div>
    </footer>
  );
}
