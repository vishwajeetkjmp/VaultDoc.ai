/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  reactStrictMode: true,
  // Allow importing the shared @vaultdocai/core TypeScript package
  transpilePackages: ["@vaultdocai/core"],
  webpack: (config) => {
    // pdf.js has an optional Node-only "canvas" dependency the browser build never uses
    config.resolve.alias.canvas = false;
    return config;
  },
  // Production is plain static files on Firebase Hosting (fast, no server to run).
  // The /signin redirect and the /s/<link> rewrite live in firebase.json there;
  // the dev server does the same here so local testing behaves identically.
  ...(isDev
    ? {
        async redirects() {
          return [{ source: "/signin", destination: "/login", permanent: true }];
        },
        async rewrites() {
          return [{ source: "/s/:linkId", destination: "/s" }];
        },
      }
    : { output: "export", images: { unoptimized: true } }),
};

module.exports = nextConfig;
