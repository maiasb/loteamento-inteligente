module.exports = {
  apps: [
    {
      name: "vale-dos-carajas",

      // Chama o Next.js direto (mais eficiente que npm start)
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",

      cwd: "/var/www/vale-dos-carajas",

      // Fork mode (1 instância) - ideal para VPS com RAM limitada
      exec_mode: "fork",
      instances: 1,

      // 🔥 CRÍTICO: Reiniciar se passar de 350MB (VPS 2GB)
      max_memory_restart: "350M",

      // Variáveis de ambiente
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      // Auto-restart e delays
      autorestart: true,
      max_restarts: 10, // Máximo de 10 restarts em 1 minuto
      min_uptime: "10s", // Considera "crashed" se cair antes de 10s
      restart_delay: 5000, // 5s entre restarts
      exp_backoff_restart_delay: 2000, // Backoff exponencial

      // Timeouts
      kill_timeout: 5000, // Tempo para SIGTERM antes de SIGKILL
      listen_timeout: 10000, // Tempo máximo para app iniciar

      // Logs (ajuste os caminhos conforme necessário)
      error_file: "/var/www/vale-dos-carajas/logs/error.log",
      out_file: "/var/www/vale-dos-carajas/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true, // Combinar logs de todas as instâncias

      // Watch: desabilitado em produção (evita restarts desnecessários)
      watch: false,
      ignore_watch: ["node_modules", "logs", ".next"],

      // Não executar cron
      cron_restart: null,
    }
  ]
};
