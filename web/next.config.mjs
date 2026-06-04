/** @type {import('next').NextConfig} */
const basePath = process.env.SITE_BASE_PATH ?? ''

const nextConfig = {
  output: 'export',
  basePath,
  // exposto ao cliente p/ prefixar URLs de imagens locais (em /public) servidas sob o basePath
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: { unoptimized: true },
  trailingSlash: true,
}

export default nextConfig
