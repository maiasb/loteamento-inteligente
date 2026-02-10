import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  // Remover 'output: export' para permitir API Routes dinâmicas
  // output: 'export', // Desabilitado - incompatível com API Routes
  
  // Configuração importante: desabilitar SSG para rotas dinâmicas durante o build
  // Isso evita timeouts tentando fazer fetch de APIs que não estão disponíveis durante build
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
  
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
    // Especificar explicitamente o diretório raiz do projeto
    root: process.cwd(),
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
