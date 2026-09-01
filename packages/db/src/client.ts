import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client.js';

export type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// `log` deliberately never includes 'query' — raw SQL parameters can carry
// ObservationSet JSON, IPs, and other sensitive values (S3-26).
export const prisma = new PrismaClient({ adapter, log: ['warn', 'error'] });
