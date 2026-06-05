-- CreateTable
CREATE TABLE "VendorLoginInfo" (
    "id" TEXT NOT NULL,
    "vendorOnboardingId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorLoginInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorLoginInfo_vendorOnboardingId_key" ON "VendorLoginInfo"("vendorOnboardingId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorLoginInfo_username_key" ON "VendorLoginInfo"("username");

-- AddForeignKey
ALTER TABLE "VendorLoginInfo" ADD CONSTRAINT "VendorLoginInfo_vendorOnboardingId_fkey" FOREIGN KEY ("vendorOnboardingId") REFERENCES "VendorOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
