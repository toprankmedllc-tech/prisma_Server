import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Neon (serverless Postgres) has a hard connection limit (default 17). Prisma's
// default pool can try to open more connections than Neon allows, causing
// "Timed out fetching a new connection from the connection pool". We cap the
// pool via the DATABASE_URL query params (connection_limit + pool_timeout),
// which is the supported way to configure the Prisma connection pool.
const PRISMA_POOL_SIZE = 10;
const PRISMA_POOL_TIMEOUT_MS = 5000;

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || '';
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=${PRISMA_POOL_SIZE}&pool_timeout=${PRISMA_POOL_TIMEOUT_MS}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      datasourceUrl: buildDatabaseUrl(),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}