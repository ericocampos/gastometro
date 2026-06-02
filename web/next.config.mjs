/** @type {import('next').NextConfig} */
const basePath = process.env.SITE_BASE_PATH ?? ''

const nextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
}

export default nextConfig
