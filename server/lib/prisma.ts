import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Always use global singleton to prevent connection pool exhaustion
export const prisma = globalForPrisma.prisma || createPrismaClient();
globalForPrisma.prisma = prisma;

export default prisma;
