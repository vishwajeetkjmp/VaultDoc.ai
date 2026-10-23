/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Plain static files on Firebase Hosting (its own site, separate from the public website)
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};
