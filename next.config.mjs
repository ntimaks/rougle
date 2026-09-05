/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the game is entirely client-side until a daily mode needs a
  // server (MECHANICS.md §9). See technical brief §1.1.
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true }, // `npm run lint` owns lint; the build does not re-run it
};

export default nextConfig;
