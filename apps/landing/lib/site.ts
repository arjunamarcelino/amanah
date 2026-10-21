/**
 * Resolve the dApp URL the "Launch the app" CTA points at.
 *
 * `NEXT_PUBLIC_APP_URL` and `NODE_ENV` are inlined at build under `output: "export"`.
 * A blank value is treated as unset. A shipped (production) build must never link to
 * localhost, so the production fallback is the public app subdomain. Throws at build if
 * the configured value is not a valid absolute URL.
 */
export function resolveAppUrl(rawEnv: string | undefined, nodeEnv: string | undefined): string {
  const fromEnv = rawEnv?.trim();
  const url =
    fromEnv ||
    (nodeEnv === "production" ? "https://app.amanah.help" : "http://localhost:3000");
  new URL(url); // validation side-effect — throws on a malformed value. Do not reassign.
  return url;
}

export const siteConfig = {
  name: "Amanah",
  url: "https://amanah.help", // reused for metadataBase + canonical
  appUrl: resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL, process.env.NODE_ENV),
} as const;
