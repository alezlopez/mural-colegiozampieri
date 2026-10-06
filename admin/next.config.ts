import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone (servidor mínimo) para a imagem Docker do Easypanel.
  output: "standalone",
};

export default nextConfig;
