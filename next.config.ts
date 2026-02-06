import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Build otimizado standalone para produção (reduz drasticamente uso de memória)
  output: isProd ? 'standalone' : undefined,
  
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  
  // Otimizações de memória para produção
  ...(isProd && {
    compress: true,
    poweredByHeader: false,
    generateEtags: false,
  }),
  
  // Configurações experimentais
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
      allowedOrigins: ['*'],
    },
    // Reduzir uso de memória
    ...(isProd && {
      workerThreads: false,
      cpus: 1,
      memoryBasedWorkersCount: true,
    }),
  },

  // Configuração do Turbopack para resolver alias
  turbopack: {
    resolveAlias: {
      canvas: './lib/canvas-mock.ts',
    },
  },
  
  // Otimizações de webpack para produção
  webpack: (config, { isServer }) => {
    if (isProd && isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        minimize: true,
      };
    }
    return config;
  },
};

export default nextConfig;
