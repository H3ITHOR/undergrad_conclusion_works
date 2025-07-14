-- AlterTable
ALTER TABLE "data" ADD COLUMN     "day" TEXT,
ADD COLUMN     "hour" TEXT,
ALTER COLUMN "date" DROP NOT NULL;
