import { prisma } from "../configs/db";

let tableEnsured = false;

export const ensureVendorLoginInfoTableExists = async () => {
  if (tableEnsured) return;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "VendorLoginInfo" (
      id TEXT PRIMARY KEY,
      "vendorOnboardingId" TEXT,
      email TEXT,
      username TEXT UNIQUE,
      "passwordHash" TEXT,
      status TEXT DEFAULT 'ACTIVE',
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
  `;

  tableEnsured = true;
};

export const findVendorLoginByUsername = async (username: string) => {
  await ensureVendorLoginInfoTableExists();

  const rows: any[] = await prisma.$queryRaw`
    SELECT id, "vendorOnboardingId", email, username, "passwordHash", status, "createdAt", "updatedAt"
    FROM "VendorLoginInfo"
    WHERE username = ${username}
    LIMIT 1
  `;

  return rows[0] ?? null;
};

export const insertVendorLogin = async (data: {
  id: string;
  vendorOnboardingId: string;
  email: string;
  username: string;
  passwordHash: string;
}) => {
  await ensureVendorLoginInfoTableExists();

  await prisma.$executeRaw`
    INSERT INTO "VendorLoginInfo" (id, "vendorOnboardingId", email, username, "passwordHash", status, "createdAt", "updatedAt")
    VALUES (${data.id}, ${data.vendorOnboardingId}, ${data.email}, ${data.username}, ${data.passwordHash}, 'ACTIVE', now(), now())
    ON CONFLICT (username) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", email = EXCLUDED.email, "updatedAt" = now();
  `;
};

export default {
  ensureVendorLoginInfoTableExists,
  findVendorLoginByUsername,
  insertVendorLogin,
};
