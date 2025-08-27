module.exports = {
  apps: [{
    name: 'voiceagent-bridge',
    script: 'dist/bridge-core.js',
    args: 'dev',
    cwd: '/opt/voiceagent-bridge',
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    env_file: './config/production.env',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_file: './logs/bridge.log',
    error_file: './logs/bridge-error.log',
    out_file: './logs/bridge-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000
  }]
}
