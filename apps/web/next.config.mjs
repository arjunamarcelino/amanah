import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function originOf(url, fallback = "") {
  try {
    return new URL(url).origin;
  } catch {
    return fallback;
  }
}

const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
const rpcOrigin = originOf(
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  "https://sepolia.base.org",
);

// CSP shipped as Report-Only first (does not block) so a real Dynamic login + donate
// run can surface violations before we flip to enforcing. frame-ancestors 'none'
// (+ X-Frame-Options) is the clickjacking defense for the approve/donate UI.
// Dynamic's auth/embedded-wallet iframe + API live on *.dynamicauth.com; its network/
// wallet icons come from app.dynamic.xyz. (Enforcing mode should add a nonce via
// DynamicContextProvider's cspNonce instead of 'unsafe-inline' for styles.)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://app.dynamic.xyz",
  "font-src 'self' data:",
  "object-src 'none'",
  `connect-src 'self' https://app.dynamicauth.com https://*.dynamicauth.com wss://*.dynamicauth.com ${apiOrigin} ${rpcOrigin}`
    .replace(/\s+/g, " ")
    .trim(),
  "frame-src https://app.dynamicauth.com https://*.dynamicauth.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for the Docker runner (apps/web/server.js).
  output: "standalone",
  // Monorepo root (two levels up) so file-tracing pulls in workspace deps and the
  // standalone output mirrors the repo layout under /app.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@amanah/ui", "@amanah/shared"],
  eslint: { ignoreDuringBuilds: true },
  // Prune barrel exports (icons, controllers) from the SDK-heavy wallet packages so the
  // (wallet) route only bundles what it imports.
  experimental: {
    optimizePackageImports: ["@dynamic-labs/sdk-react-core", "@dynamic-labs/ethereum", "wagmi"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy are set once
          // at the edge by Caddy's (secure_headers) snippet (docker/Caddyfile) — kept out of
          // here to avoid duplicate/conflicting headers on app.amanah.help. Permissions-Policy
          // is app-specific and not in that snippet, so it stays.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Report-Only until a real Dynamic login + donate run confirms the policy
          // doesn't block the auth iframe/inline styles; then flip to enforcing.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  webpack: (config, { webpack }) => {
    // Dynamic's EthereumWalletConnectors pull the WalletConnect/Coinbase/MetaMask wagmi
    // connectors, whose SDKs statically import optional modules we never exercise in the
    // browser bundle: @x402/* (Coinbase payment), @react-native-async-storage (MetaMask
    // SDK). Stub the whole scopes to empty modules so webpack resolves them; also mark the
    // classic optional node-only deps as externals. Dynamic also pulls pino/pino-pretty.
    // If a build ever genuinely needs one of these, narrow the regex.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\/|^@react-native-async-storage\//,
      }),
    );
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
