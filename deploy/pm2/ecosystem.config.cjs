/**
 * PM2 — Eyano API (palier 3, squelette).
 * En production : API env dans /etc/eyano/api.env
 */
module.exports = {
  apps: [
    {
      name: "eyano-api",
      cwd: "/var/www/eyano/backend",
      script: "dist/main.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      env_file: "/etc/eyano/api.env",
      max_memory_restart: "512M",
      merge_logs: true,
      error_file: "/var/log/eyano/api-error.log",
      out_file: "/var/log/eyano/api-out.log",
    },
  ],
};