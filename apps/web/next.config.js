/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing the shared @vaultdocai/core TypeScript package
  transpilePackages: ["@vaultdocai/core"],
  webpack: (config) => {
    // pdf.js has an optional Node-only "canvas" dependency the browser build never uses
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
