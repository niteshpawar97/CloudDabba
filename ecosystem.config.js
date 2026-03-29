module.exports = {
  apps: [
    {
      name: 'clouddabba-api',
      cwd: '/opt/clouddabba/backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
