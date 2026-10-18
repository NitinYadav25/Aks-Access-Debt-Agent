/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['falkordb', 'redis', '@redis/client', '@js-temporal/polyfill'],
};


export default nextConfig;
