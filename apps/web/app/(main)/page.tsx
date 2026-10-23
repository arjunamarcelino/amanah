import type { Metadata } from "next";
import { DiscoverView } from "@/components/DiscoverView";

// Server component so the route can set its own <title>; the browse UI itself is the client
// DiscoverView (hooks + live search). Overrides the root layout's "Amanah" title for "/".
export const metadata: Metadata = {
  title: "Amanah - Discover",
};

export default function DiscoverPage() {
  return <DiscoverView />;
}
