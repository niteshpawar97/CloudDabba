import prisma from '../../database/connection';
import { config } from '../config/app.config';

export async function allocatePort(): Promise<number> {
  const usedPorts = await prisma.deployment.findMany({
    where: {
      containerPort: { not: null },
      status: { in: ['LIVE', 'DEPLOYING', 'BUILDING'] },
    },
    select: { containerPort: true },
  });

  const usedSet = new Set(usedPorts.map((d: any) => d.containerPort));

  for (let port = config.ports.rangeStart; port <= config.ports.rangeEnd; port++) {
    if (!usedSet.has(port)) {
      return port;
    }
  }

  throw new Error('No available ports in the configured range');
}
