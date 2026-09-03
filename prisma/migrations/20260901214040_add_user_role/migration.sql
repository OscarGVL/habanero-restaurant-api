-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';
