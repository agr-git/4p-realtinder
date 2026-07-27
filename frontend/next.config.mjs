/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las fotos de los inmuebles vienen del CDN de Wasi.
  images: { remotePatterns: [{ protocol: "https", hostname: "image.wasi.co" }] },
};
export default nextConfig;
