/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.vlr.gg" },
      { protocol: "https", hostname: "*.vlr.gg" },
    ],
  },
};

module.exports = nextConfig;
