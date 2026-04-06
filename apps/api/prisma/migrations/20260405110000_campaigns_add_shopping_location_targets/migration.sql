DO $$
BEGIN
  ALTER TYPE "CampaignTargetMode" ADD VALUE 'SHOPPING';
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

DO $$
BEGIN
  ALTER TYPE "CampaignTargetMode" ADD VALUE 'LOCATION';
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

CREATE TYPE "CampaignLocationLevel" AS ENUM ('COUNTRY', 'PROVINCE', 'CITY');

ALTER TABLE "Campaign"
  ADD COLUMN "targetAllShoppings" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "locationLevel" "CampaignLocationLevel";

CREATE TABLE "CampaignTargetShopping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "shoppingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignTargetShopping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignTargetLocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "level" "CampaignLocationLevel" NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignTargetLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignTargetShopping_campaignId_shoppingId_key" ON "CampaignTargetShopping"("campaignId", "shoppingId");
CREATE INDEX "CampaignTargetShopping_tenantId_idx" ON "CampaignTargetShopping"("tenantId");
CREATE INDEX "CampaignTargetShopping_campaignId_idx" ON "CampaignTargetShopping"("campaignId");
CREATE INDEX "CampaignTargetShopping_shoppingId_idx" ON "CampaignTargetShopping"("shoppingId");

CREATE UNIQUE INDEX "CampaignTargetLocation_campaignId_level_value_key" ON "CampaignTargetLocation"("campaignId", "level", "value");
CREATE INDEX "CampaignTargetLocation_tenantId_idx" ON "CampaignTargetLocation"("tenantId");
CREATE INDEX "CampaignTargetLocation_campaignId_idx" ON "CampaignTargetLocation"("campaignId");
CREATE INDEX "CampaignTargetLocation_level_idx" ON "CampaignTargetLocation"("level");

CREATE INDEX "Campaign_tenantId_locationLevel_idx" ON "Campaign"("tenantId", "locationLevel");

ALTER TABLE "CampaignTargetShopping"
  ADD CONSTRAINT "CampaignTargetShopping_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignTargetShopping"
  ADD CONSTRAINT "CampaignTargetShopping_shoppingId_fkey"
  FOREIGN KEY ("shoppingId") REFERENCES "Shopping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignTargetLocation"
  ADD CONSTRAINT "CampaignTargetLocation_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
