import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../../shared/config/app.config';
import logger from '../../shared/utils/logger';

// Map: deploymentId -> Set of WebSocket connections
const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const deploymentId = url.searchParams.get('deploymentId');

    // Authenticate
    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      jwt.verify(token, config.jwt.secret);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    if (!deploymentId) {
      ws.close(4002, 'deploymentId required');
      return;
    }

    // Register client
    if (!clients.has(deploymentId)) {
      clients.set(deploymentId, new Set());
    }
    clients.get(deploymentId)!.add(ws);

    logger.debug(`WS client connected for deployment ${deploymentId}`);

    ws.on('close', () => {
      const set = clients.get(deploymentId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) clients.delete(deploymentId);
      }
      logger.debug(`WS client disconnected for deployment ${deploymentId}`);
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error:', err);
    });
  });

  logger.info('WebSocket server initialized');
  return wss;
}

export function broadcastLog(deploymentId: string, data: { type: string; message: string; timestamp: string }) {
  const set = clients.get(deploymentId);
  if (!set || set.size === 0) return;

  const payload = JSON.stringify(data);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

export function broadcastStatus(deploymentId: string, status: string) {
  broadcastLog(deploymentId, {
    type: 'STATUS',
    message: status,
    timestamp: new Date().toISOString(),
  });
}
