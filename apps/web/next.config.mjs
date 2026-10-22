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

// CSP shipped as Report-Only first (does not block) so a real Privy login + donate
// run can surface violations before we flip to enforcing. frame-ancestors 'none'
// (+ X-Frame-Options) is the clickjacking defense for the approve/donate UI.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "object-src 'none'",
  `connect-src 'self' https://auth.privy.io https://*.privy.io wss://*.privy.io ${apiOrigin} ${rpcOrigin}`
    .replace(/\s+/g, " ")
    .trim(),
  "frame-src https://auth.privy.io https://*.privy.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@amanah/ui", "@amanah/shared"],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Report-Only until a real Privy login + donate run confirms the policy
          // doesn't block the auth iframe/inline styles; then flip to enforcing.
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  webpack: (config, { webpack }) => {
    // Wallet SDKs pulled transitively by @privy-io/wagmi (Coinbase/Base connectors)
    // statically import optional @x402/* payment modules we never exercise in the
    // embedded-wallet donor flow. Stub the whole scope to empty modules so webpack
    // resolves them; also mark the classic optional node-only deps as externals.
    // SAFE because the flow is embedded-wallet-only (no injected/Coinbase connector
    // is configured). Revisit if such a connector is ever added — the stubbed path
    // would then resolve to an empty module and fail opaquely.
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
