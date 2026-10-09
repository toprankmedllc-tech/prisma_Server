// import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';

// // Neon (serverless Postgres) has a hard connection limit (default 17). Prisma's
// // default pool can try to open more connections than Neon allows, causing
// // "Timed out fetching a new connection from the connection pool". We cap the
// // pool via the DATABASE_URL query params (connection_limit + pool_timeout),
// // which is the supported way to configure the Prisma connection pool.
// const PRISMA_POOL_SIZE = 10;
// const PRISMA_POOL_TIMEOUT_MS = 5000;

// function buildDatabaseUrl(): string {
//   const url = process.env.DATABASE_URL || '';
//   if (!url) return url;
//   const separator = url.includes('?') ? '&' : '?';
//   return `${url}${separator}connection_limit=${PRISMA_POOL_SIZE}&pool_timeout=${PRISMA_POOL_TIMEOUT_MS}`;
// }

// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit {
//   constructor() {
//     super({
//       datasourceUrl: buildDatabaseUrl(),
//     });
//   }

//   async onModuleInit() {
//     await this.$connect();
//   }

//   async enableShutdownHooks(app: INestApplication) {
//     process.on('beforeExit', async () => {
//       await app.close();
//     });
//   }
// }



import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const PRISMA_POOL_SIZE = 10;
const PRISMA_POOL_TIMEOUT_MS = 5000;
const PRISMA_CONNECT_TIMEOUT_S = 15;

function buildDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }
  const u = new URL(raw);
  if (!u.searchParams.has('connect_timeout')) {
    u.searchParams.set('connect_timeout', String(PRISMA_CONNECT_TIMEOUT_S));
  }
  if (!u.searchParams.has('connection_limit')) {
    u.searchParams.set('connection_limit', String(PRISMA_POOL_SIZE));
  }
  if (!u.searchParams.has('pool_timeout')) {
    u.searchParams.set('pool_timeout', String(PRISMA_POOL_TIMEOUT_MS));
  }
  return u.toString();
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ datasourceUrl: buildDatabaseUrl() });
  }

  async onModuleInit() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Prisma connected to Neon');
        return;
      } catch (err) {
        this.logger.warn(
          `Prisma connect attempt ${attempt}/${maxRetries} failed: ${(err as Error).message}`,
        );
        if (attempt === maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}