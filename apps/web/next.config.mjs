/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@amanah/ui", "@amanah/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
