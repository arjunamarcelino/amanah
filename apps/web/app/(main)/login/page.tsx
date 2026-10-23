"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { Card, CardContent } from "@amanah/ui/card";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { assertNever } from "@/lib/assertNever";

// The single connect-wallet surface for the whole app. Wallet-only flows (donate, mint) send
// unauthenticated visitors here via RequireWallet with a `?next=` back-link. Mounts inside the
// (main) group, so the Dynamic + wagmi providers are already in scope. Once a wallet is active
// we redirect straight back to `next` (or Discover) — a connected user never sits on /login.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-serif text-3xl tracking-tight">Sign in to Amanah</h1>
        <p className="text-sm text-foreground-soft">
          Connect a wallet — or log in with email or social — to donate and track your giving
          on-chain.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Suspense fallback={<Hint>Loading…</Hint>}>
            <LoginBody />
          </Suspense>
        </CardContent>
      </Card>

      <Link
        href="/"
        className="text-center text-sm text-foreground-soft underline underline-offset-4 hover:no-underline"
      >
        ← Back to campaigns
      </Link>
    </main>
  );
}

function LoginBody() {
  const { state } = useDonorWallet();
  const router = useRouter();
  const params = useSearchParams();

  // Already connected → leave immediately. Only internal paths are honored as `next` (an
  // absolute or protocol-relative value could redirect off-site), otherwise fall back to "/".
  const nextParam = params.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

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

function Hint({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-foreground-soft">
      {children}
    </p>
  );
}
