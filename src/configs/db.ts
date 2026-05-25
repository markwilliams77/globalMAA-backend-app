import { PrismaClient } from "@prisma/client";
import process from "process";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const connectDB = async () => {
  try {
    await prisma.$connect(); // establishes connection
    await prisma.$queryRaw`SELECT 1`; // verifies DB is reachable

    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1); // stop server if DB fails (important)
  }
};