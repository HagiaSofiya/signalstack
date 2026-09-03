import { PrismaClient } from "@prisma/client";

import { getDatabaseEnv } from "./env.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const prisma = new PrismaClient({
    datasources: { db: { url: getDatabaseEnv().DATABASE_URL } },
  });
  globalForPrisma.prisma = prisma;
  return prisma;
}
