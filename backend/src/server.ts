import http from 'http';
import app from './app';
import { config } from './shared/config/app.config';
import { setupWebSocket } from './infrastructure/websocket/log-stream';
import prisma from './database/connection';
import logger from './shared/utils/logger';

const server = http.createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Start server
async function start() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected successfully');

    server.listen(config.app.port, () => {
      logger.info(`CloudDabba API running on port ${config.app.port}`);
      logger.info(`Environment: ${config.app.nodeEnv}`);
      logger.info(`API: http://localhost:${config.app.port}/api/${config.app.apiVersion}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
