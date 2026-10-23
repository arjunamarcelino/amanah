import type { Metadata } from "next";
import { LoginView } from "@/components/LoginView";

// Server page: sets the route <title> and keeps it out of static prerender (the wallet
// providers only exist at runtime). The sign-in UI is the client LoginView.
export const metadata: Metadata = {
  title: "Sign In | Amanah",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginView />;
}
