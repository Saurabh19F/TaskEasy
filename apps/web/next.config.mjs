/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: false,
  },
  images: {
    domains: ['res.cloudinary.com'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://taskeasy-api.onrender.com/api',
    NEXT_PUBLIC_APP_NAME: 'TaskEasy',
  },
};

export default nextConfig;
