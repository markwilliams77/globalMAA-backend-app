-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "category" TEXT,
ADD COLUMN     "specialty" TEXT,
ADD COLUMN     "staffCount" TEXT,
ADD COLUMN     "startingPrice" TEXT,
ADD COLUMN     "stats" JSONB,
ALTER COLUMN "accreditation" SET DEFAULT ARRAY[]::TEXT[];
