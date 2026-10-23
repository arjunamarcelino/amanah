"use client";

import Image from "next/image";
import Link from "next/link";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { Button } from "@amanah/ui/button";
import { Card, CardContent } from "@amanah/ui/card";
import { useDonorWallet } from "@/lib/hooks/useDonorWallet";
import { assertNever } from "@/lib/assertNever";

// Dedicated sign-in route. The landing header's "Sign in" links here. Mounts inside the
// (wallet) group, so WalletProviders (Dynamic + wagmi) are already in scope; this page is
// the connect-wallet surface. Never statically prerendered — providers only exist at runtime.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 md:p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Link href="/" aria-label="Amanah — home">
          <Image
            src="/amanah-logo.png"
            alt="Amanah"
            width={267}
            height={100}
            priority
            className="h-10 w-auto"
          />
        </Link>
        <h1 className="font-serif text-3xl tracking-tight">Sign in to Amanah</h1>
        <p className="text-sm text-foreground-soft">
          Connect a wallet, or log in with email or social, to donate and track your giving
          on-chain.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <LoginBody />
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

  switch (state.status) {
    case "initializing":
      return (
        <p role="status" className="text-sm text-foreground-soft">
          Loading wallet…
        </p>
      );
    case "unauthenticated":
      return <DynamicWidget />;
    case "provisioning":
      return (
        <p role="status" className="text-sm text-foreground-soft">
          Finishing wallet setup…
        </p>
      );
    case "active": {
      const { address } = state;
      const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
      return (
        <div className="flex w-full flex-col items-center gap-4">
          <div role="status" className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">You&apos;re signed in</p>
            <p className="font-mono text-sm text-foreground-soft" title={address}>
              <span aria-hidden="true">{short}</span>
              <span className="sr-only">Connected wallet address {address}</span>
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/">Continue to campaigns</Link>
          </Button>
        </div>
      );
    }
    default:
      return assertNever(state);
  }
}
