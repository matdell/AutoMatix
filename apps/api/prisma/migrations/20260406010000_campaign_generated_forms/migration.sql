CREATE TABLE "CampaignGeneratedForm" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "invitationId" TEXT,
  "processor" TEXT NOT NULL,
  "campaignType" TEXT NOT NULL,
  "formTemplate" TEXT NOT NULL,
  "mainForm" JSONB NOT NULL,
  "binsSheet" JSONB NOT NULL,
  "merchantsSheet" JSONB NOT NULL,
  "financingSheet" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignGeneratedForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignGeneratedForm_campaignId_merchantId_processor_formTemplate_key"
  ON "CampaignGeneratedForm" ("campaignId", "merchantId", "processor", "formTemplate");

CREATE INDEX "CampaignGeneratedForm_tenantId_idx"
  ON "CampaignGeneratedForm" ("tenantId");

CREATE INDEX "CampaignGeneratedForm_campaignId_idx"
  ON "CampaignGeneratedForm" ("campaignId");

CREATE INDEX "CampaignGeneratedForm_merchantId_idx"
  ON "CampaignGeneratedForm" ("merchantId");

CREATE INDEX "CampaignGeneratedForm_invitationId_idx"
  ON "CampaignGeneratedForm" ("invitationId");

CREATE INDEX "CampaignGeneratedForm_tenantId_processor_idx"
  ON "CampaignGeneratedForm" ("tenantId", "processor");

ALTER TABLE "CampaignGeneratedForm"
  ADD CONSTRAINT "CampaignGeneratedForm_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Bank"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignGeneratedForm"
  ADD CONSTRAINT "CampaignGeneratedForm_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignGeneratedForm"
  ADD CONSTRAINT "CampaignGeneratedForm_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignGeneratedForm"
  ADD CONSTRAINT "CampaignGeneratedForm_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
