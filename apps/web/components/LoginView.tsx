"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { assertNever } from "@/lib/assertNever";

// The single connect-wallet surface for the app, styled like a GoFundMe sign-in: a centered
// card on a soft backdrop with a welcoming heading, the connect control, and trust points.
// Auth itself is Dynamic's widget (wallet / email / social). Wallet-only flows (donate, mint)
// send unauthenticated visitors here via RequireWallet with a `?next=` back-link; once a wallet
// is active we redirect straight back to `next` (or Discover).
export function LoginView() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
      {/* Soft brand glow behind the card, echoing the landing hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[55%] bg-[radial-gradient(60%_100%_at_50%_0%,hsl(144_45%_45%/0.07),transparent_70%)]"
      />

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center gap-5">
            {/* No navbar on this page, so the brand, heading and caption live in the card. */}
            <Link href="/" aria-label="Amanah — home" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Image src="/amanah-logo.png" alt="Amanah" width={267} height={100} priority className="h-9 w-auto" />
            </Link>
            <div className="flex flex-col gap-2 text-center">
              <h1 className="font-serif text-3xl tracking-tight text-foreground">Welcome back</h1>
              <p className="text-sm text-foreground-soft">
                Sign in to donate and follow your giving on-chain.
              </p>
            </div>

            <Suspense fallback={<Hint>Loading…</Hint>}>
              <LoginBody />
            </Suspense>

            <div className="flex w-full items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span className="inline-flex items-center gap-1.5">
                Secured on
                <Image src="/chains/base-logo.svg" alt="Base" width={75} height={19} className="h-[0.95rem] w-auto" />
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-foreground-soft">
              {["Gasless", "Any stablecoin", "Fully on-chain"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-foreground-soft underline underline-offset-4 hover:no-underline"
          >
            ← Back to campaigns
          </Link>
        </p>
      </div>
    </main>
  );
}

function LoginBody() {
  const { state } = useDonorWallet();
  const router = useRouter();
  const params = useSearchParams();

  // Already connected → leave immediately. `next` must resolve to THIS origin, else fall back
  // to "/": a string-prefix check ("/"-but-not-"//") is bypassable via backslash ("/\evil.com"
  // normalizes to a foreign origin), so validate the resolved origin instead — this page's job
  // is connecting a funds-moving wallet, so an open redirect here is a phishing primitive.
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (state.status === "active") router.replace(next);
  }, [state.status, next, router]);

  switch (state.status) {
    case "initializing":
      return <Hint>Loading wallet…</Hint>;
    case "unauthenticated":
      return <DynamicWidget />;
    case "provisioning":
      return <Hint>Finishing wallet setup…</Hint>;
    case "active":
      return <Hint>You&apos;re signed in — redirecting…</Hint>;
    default:
      return assertNever(state);
  }
}

// Resolve a `?next=` param against this origin; return a same-origin path or "/".
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : "/";
  } catch {
    return "/";
  }
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-foreground-soft">
      {children}
    </p>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-4 text-primary"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
