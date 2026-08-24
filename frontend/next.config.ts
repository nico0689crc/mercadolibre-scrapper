import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El repo tiene lockfile propio en la raiz (scripts del monorepo): fijamos
  // la raiz de Turbopack a este paquete para que no la infiera mal.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Imagen de produccion minima: server.js autocontenido, sin node_modules.
  output: "standalone",
  // Las fotos de producto vienen del CDN de Mercado Libre.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.mlstatic.com" },
      { protocol: "http", hostname: "*.mlstatic.com" },
    ],
  },
  // El dev server se accede tambien via el tunel ngrok de desarrollo.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok.io"],
};

export default nextConfig;
