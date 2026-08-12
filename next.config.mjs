/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bcryptjs is pure-JS; keep it external to server bundle to avoid any bundling quirks.
  serverExternalPackages: ["bcryptjs", "@prisma/client"],
};

export default nextConfig;
