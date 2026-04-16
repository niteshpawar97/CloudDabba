const path = require('path');
const appDir = path.resolve(__dirname, 'backend');

module.exports = {
  apps: [
    {
      name: 'clouddabba-api',
      cwd: appDir,
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 6050,
      },
    },
  ],
};
