import dotenv from 'dotenv';
dotenv.config();

export const config = {
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
  },
  db: {
    url: process.env.DATABASE_URL || 'postgresql://clouddabba:password@localhost:5432/clouddabba',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expire: process.env.JWT_EXPIRE || '7d',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  domain: {
    base: process.env.BASE_DOMAIN || 'localhost',
  },
  docker: {
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  },
  nginx: {
    sitesPath: process.env.NGINX_SITES_PATH || '/etc/nginx/sites-enabled',
    reloadCmd: process.env.NGINX_RELOAD_CMD || 'nginx -s reload',
  },
  ports: {
    rangeStart: parseInt(process.env.PORT_RANGE_START || '10000', 10),
    rangeEnd: parseInt(process.env.PORT_RANGE_END || '20000', 10),
  },
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
  provisionDb: {
    adminUrl: process.env.PROVISION_DB_ADMIN_URL || 'postgresql://clouddabba:password@localhost:5432/postgres',
    host: process.env.PROVISION_DB_HOST || 'localhost',
    port: parseInt(process.env.PROVISION_DB_PORT || '5432', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
} as const;
