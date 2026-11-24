module.exports = {
  apps: [
    {
      name: "kapsapp-production",
      script: "./dist/server.cjs",
      instances: 1, // Single instance for WebSocket state consistency
      exec_mode: "fork",
      watch: false,
      ignore_watch: [
        "node_modules",
        "logs",
        "uploads",
        "data",
        "*.db",
        "*.db-wal",
        "*.db-shm",
        "*.db-journal",
        "*.sqlite*",
      ],
      max_memory_restart: "900M",
      node_args: "--max-old-space-size=896",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        KAPSAPP_DATA_DIR: process.env.KAPSAPP_DATA_DIR || "/var/lib/kapsapp",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
        KAPSAPP_DATA_DIR: process.env.KAPSAPP_DATA_DIR || "/var/lib/kapsapp",
      },
      exp_backoff_restart_delay: 100,
      listen_timeout: 8000,
      kill_timeout: 8000,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
    },
  ],
};
