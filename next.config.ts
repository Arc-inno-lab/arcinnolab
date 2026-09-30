import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos, logos et documents passent par des Server Actions, plafonnées
      // à 1 Mo par défaut : un simple PDF scanné était refusé sans explication.
      // 4 Mo reste sous la limite de corps de requête de Vercel (4,5 Mo).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
