import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    let databaseStatus = 'connected';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = 'disconnected';
    }

    const healthy = databaseStatus === 'connected';

    return {
      success: healthy,
      message: healthy
        ? 'Service is healthy'
        : 'Database connection failed',
      data: {
        service: 'unicolors-api',
        status: healthy ? 'healthy' : 'degraded',
        environment: process.env.NODE_ENV ?? 'development',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        dependencies: {
          database: databaseStatus,
          redis: 'not_configured',
          storage: 'not_configured',
        },
      },
      meta: {},
    };
  }
}