import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../../shared/config/app.config';
import { DockerService } from '../../core/services/docker.service';
import prisma from '../../database/connection';
import logger from '../../shared/utils/logger';

// Map: deploymentId -> Set of WebSocket connections
const clients = new Map<string, Set<WebSocket>>();
// Map: ws -> cleanup function for container log streams
const containerStreams = new Map<WebSocket, () => void>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const deploymentId = url.searchParams.get('deploymentId');
    const mode = url.searchParams.get('mode'); // 'container' for live container logs

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

    // Interactive debug-shell mode: client sends `{ command: string }` messages,
    // we stream stdout/stderr chunks back as JSON, and emit a final `EXIT` event
    // with the exit code. One command at a time per socket — concurrent commands
    // are rejected so the UI's output stays coherent.
    if (mode === 'exec') {
      let deployment;
      try {
        deployment = await prisma.deployment.findUnique({
          where: { id: deploymentId },
          select: { containerId: true, status: true },
        });
      } catch (err: any) {
        ws.close(4006, 'DB error');
        return;
      }
      if (!deployment?.containerId) {
        ws.send(JSON.stringify({ type: 'SYSTEM', message: 'No container is running for this deployment.' }));
        ws.close(4003, 'No container');
        return;
      }
      if (deployment.status !== 'LIVE') {
        ws.send(JSON.stringify({ type: 'SYSTEM', message: `Container is ${deployment.status} — start it first.` }));
        ws.close(4004, 'Container not running');
        return;
      }

      let currentAbort: AbortController | null = null;

      ws.on('message', async (raw) => {
        let payload: any;
        try { payload = JSON.parse(raw.toString()); } catch { return; }

        // Allow the client to cancel a long-running command (Ctrl+C semantics).
        if (payload?.kind === 'cancel') {
          currentAbort?.abort();
          return;
        }

        const cmd = (payload?.command || '').toString().trim();
        if (!cmd) return;
        if (currentAbort) {
          ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Another command is still running.' }));
          return;
        }

        currentAbort = new AbortController();
        ws.send(JSON.stringify({ type: 'START', command: cmd }));

        try {
          const { exitCode } = await DockerService.execStream(
            deployment.containerId!,
            ['sh', '-c', cmd],
            (chunk) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'STDOUT', message: chunk }));
              }
            },
            (chunk) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'STDERR', message: chunk }));
              }
            },
            currentAbort.signal,
          );
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'EXIT', exitCode }));
          }
        } catch (err: any) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'STDERR', message: err?.message || String(err) }));
            ws.send(JSON.stringify({ type: 'EXIT', exitCode: -1 }));
          }
        } finally {
          currentAbort = null;
        }
      });

      ws.on('close', () => { currentAbort?.abort(); });
      ws.on('error', () => { currentAbort?.abort(); });
      ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Connected. Type a command and press Enter.' }));
      return;
    }

    // Container log streaming mode
    if (mode === 'container') {
      try {
        const deployment = await prisma.deployment.findUnique({
          where: { id: deploymentId },
          select: { containerId: true, status: true },
        });

        if (!deployment?.containerId) {
          ws.send(JSON.stringify({ type: 'SYSTEM', message: 'No container found for this deployment', timestamp: new Date().toISOString() }));
          ws.close(4003, 'No container');
          return;
        }

        if (deployment.status !== 'LIVE') {
          ws.send(JSON.stringify({ type: 'SYSTEM', message: `Container is ${deployment.status}`, timestamp: new Date().toISOString() }));
          ws.close(4004, 'Container not running');
          return;
        }

        logger.debug(`WS container logs stream started for deployment ${deploymentId}`);

        const cleanup = await DockerService.streamContainerLogs(
          deployment.containerId,
          (line) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'RUNTIME',
                message: line,
                timestamp: new Date().toISOString(),
              }));
            }
          },
          (err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'SYSTEM',
                message: `Log stream error: ${err.message}`,
                timestamp: new Date().toISOString(),
              }));
            }
          }
        );

        containerStreams.set(ws, cleanup);

        ws.on('close', () => {
          const cleanupFn = containerStreams.get(ws);
          if (cleanupFn) {
            cleanupFn();
            containerStreams.delete(ws);
          }
          logger.debug(`WS container logs stream closed for deployment ${deploymentId}`);
        });

        ws.on('error', (err) => {
          logger.error('WebSocket container stream error:', err);
          const cleanupFn = containerStreams.get(ws);
          if (cleanupFn) {
            cleanupFn();
            containerStreams.delete(ws);
          }
        });

        return;
      } catch (err: any) {
        logger.error('Failed to start container log stream:', err);
        ws.send(JSON.stringify({ type: 'SYSTEM', message: `Failed to stream logs: ${err.message}`, timestamp: new Date().toISOString() }));
        ws.close(4005, 'Stream failed');
        return;
      }
    }

    // Default: build/deploy log streaming
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
