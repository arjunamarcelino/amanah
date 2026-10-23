// Routes where the app chrome is minimized: the SiteHeader drops its search box and the
// SiteFooter is hidden, keeping these task-focused flows (e.g. the token faucet) distraction-
// free. Matched by exact path or as a path prefix (so nested segments count).
const FOCUSED_PREFIXES = ["/mint", "/donate"];

export function isFocusedRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return FOCUSED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
