/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing the shared @vaultdocai/core TypeScript package
  transpilePackages: ["@vaultdocai/core"],
};

module.exports = nextConfig;