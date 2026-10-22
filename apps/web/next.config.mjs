/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@amanah/ui", "@amanah/shared"],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { webpack }) => {
    // Wallet SDKs pulled transitively by @privy-io/wagmi (Coinbase/Base connectors)
    // statically import optional @x402/* payment modules we never exercise in the
    // embedded-wallet donor flow. Stub the whole scope to empty modules so webpack
    // resolves them; also mark the classic optional node-only deps as externals.
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
