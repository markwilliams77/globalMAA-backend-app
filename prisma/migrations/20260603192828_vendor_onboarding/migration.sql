-- CreateEnum
CREATE TYPE "VendorOnboardingStatus" AS ENUM ('DRAFT', 'DOCUMENTS_PENDING', 'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'UNDER_REVIEW', 'PENDING_ACTIVATION', 'ACTIVE', 'REJECTED');

-- CreateTable
CREATE TABLE "VendorOnboarding" (
    "id" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "orgType" TEXT NOT NULL,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plan" TEXT NOT NULL,
    "documents" JSONB DEFAULT '{}',
    "paymentOrderId" TEXT,
    "paymentStatus" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "status" "VendorOnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorOnboarding_email_key" ON "VendorOnboarding"("email");
