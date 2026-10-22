/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/dashboard/admin/setup', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] }];
  },
  reactStrictMode: false,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
