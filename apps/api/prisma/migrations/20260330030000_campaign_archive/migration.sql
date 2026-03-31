-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "estadoAnterior" "CampaignStatus";
