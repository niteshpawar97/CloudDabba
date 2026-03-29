import prisma from '../../database/connection';
import { broadcastLog } from '../../infrastructure/websocket/log-stream';

export class LogService {
  static async createLog(deploymentId: string, type: string, message: string) {
    const log = await prisma.log.create({
      data: { deploymentId, type: type as any, message },
    });

    broadcastLog(deploymentId, {
      type,
      message,
      timestamp: log.timestamp.toISOString(),
    });

    return log;
  }

  static async getLogs(deploymentId: string, page = 1, limit = 100) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.log.findMany({
        where: { deploymentId },
        orderBy: { timestamp: 'asc' },
        skip,
        take: limit,
      }),
      prisma.log.count({ where: { deploymentId } }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  static async streamLog(deploymentId: string, type: string, message: string) {
    broadcastLog(deploymentId, {
      type,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
