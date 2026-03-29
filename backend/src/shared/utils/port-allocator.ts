import { execFile } from 'child_process';
import { promisify } from 'util';
import prisma from '../../database/connection';
import { config } from '../config/app.config';
import docker from '../../infrastructure/docker/docker-client';
import logger from './logger';

const execFileAsync = promisify(execFile);

export async function allocatePort(): Promise<number> {
  // Get ports used in DB
  const dbPorts = await prisma.deployment.findMany({
    where: {
      containerPort: { not: null },
      status: { in: ['LIVE', 'DEPLOYING', 'BUILDING'] },
    },
    select: { containerPort: true },
  });

  const usedSet = new Set(dbPorts.map((d: any) => d.containerPort));

  // Also check actual Docker containers for used ports
  try {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
      if (c.Ports) {
        for (const p of c.Ports) {
          if (p.PublicPort) {
            usedSet.add(p.PublicPort);
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn(`Could not check Docker ports: ${err.message}`);
  }

  // Also check OS-level port usage
  try {
    const { stdout } = await execFileAsync('ss', ['-tlnp']);
    const lines = stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/:(\d+)\s/);
      if (match) {
        usedSet.add(parseInt(match[1]));
      }
    }
  } catch {
    // ss not available, skip
  }

  for (let port = config.ports.rangeStart; port <= config.ports.rangeEnd; port++) {
    if (!usedSet.has(port)) {
      return port;
    }
  }

  throw new Error('No available ports in the configured range');
}
