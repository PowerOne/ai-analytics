-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "name" TEXT,
ADD COLUMN     "subject" TEXT,
ALTER COLUMN "school_id" DROP NOT NULL;
