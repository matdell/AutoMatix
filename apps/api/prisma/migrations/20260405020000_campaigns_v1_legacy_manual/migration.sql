ALTER TABLE "Bank"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';

DROP TABLE IF EXISTS "CampaignMerchant";
DROP TABLE IF EXISTS "Campaign";

DROP TYPE IF EXISTS "CampaignType";
DROP TYPE IF EXISTS "CampaignStatus";

CREATE TYPE "CampaignStatus" AS ENUM ('EDITING', 'PENDING', 'ACTIVE', 'FINALIZED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "CampaignTargetMode" AS ENUM ('RETAILER_PDV', 'RUBROS');
CREATE TYPE "CampaignCloseType" AS ENUM ('WITH_CLOSE_DATE', 'WITHOUT_CLOSE_DATE');

CREATE TABLE "BankCampaignTypeConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "mode" "CampaignTargetMode" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankCampaignTypeConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "campaignTypeConfigId" TEXT NOT NULL,
  "closeType" "CampaignCloseType" NOT NULL,
  "estado" "CampaignStatus" NOT NULL DEFAULT 'EDITING',
  "estadoAnterior" "CampaignStatus",
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "fechaVigDesde" TIMESTAMP(3) NOT NULL,
  "fechaVigHasta" TIMESTAMP(3) NOT NULL,
  "fechaCierre" TIMESTAMP(3),
  "dias" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fechaPrioridad" TIMESTAMP(3),
  "condiciones" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignTargetRetailer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "retailerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignTargetRetailer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignTargetBranch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignTargetBranch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignTargetCategory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignTargetCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignPaymentMethod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "cardCodeConfigId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CampaignPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankCampaignTypeConfig_tenantId_nombre_key" ON "BankCampaignTypeConfig" ("tenantId", "nombre");
CREATE UNIQUE INDEX "CampaignTargetRetailer_campaignId_retailerId_key" ON "CampaignTargetRetailer" ("campaignId", "retailerId");
CREATE UNIQUE INDEX "CampaignTargetBranch_campaignId_branchId_key" ON "CampaignTargetBranch" ("campaignId", "branchId");
CREATE UNIQUE INDEX "CampaignTargetCategory_campaignId_categoryId_key" ON "CampaignTargetCategory" ("campaignId", "categoryId");
CREATE UNIQUE INDEX "CampaignPaymentMethod_campaignId_cardCodeConfigId_key" ON "CampaignPaymentMethod" ("campaignId", "cardCodeConfigId");

CREATE INDEX "BankCampaignTypeConfig_tenantId_idx" ON "BankCampaignTypeConfig" ("tenantId");
CREATE INDEX "BankCampaignTypeConfig_tenantId_active_idx" ON "BankCampaignTypeConfig" ("tenantId", "active");
CREATE INDEX "BankCampaignTypeConfig_tenantId_mode_idx" ON "BankCampaignTypeConfig" ("tenantId", "mode");

CREATE INDEX "Campaign_tenantId_idx" ON "Campaign" ("tenantId");
CREATE INDEX "Campaign_tenantId_estado_idx" ON "Campaign" ("tenantId", "estado");
CREATE INDEX "Campaign_tenantId_fechaVigHasta_idx" ON "Campaign" ("tenantId", "fechaVigHasta");
CREATE INDEX "Campaign_campaignTypeConfigId_idx" ON "Campaign" ("campaignTypeConfigId");
CREATE INDEX "Campaign_archivedById_idx" ON "Campaign" ("archivedById");

CREATE INDEX "CampaignTargetRetailer_tenantId_idx" ON "CampaignTargetRetailer" ("tenantId");
CREATE INDEX "CampaignTargetRetailer_campaignId_idx" ON "CampaignTargetRetailer" ("campaignId");
CREATE INDEX "CampaignTargetRetailer_retailerId_idx" ON "CampaignTargetRetailer" ("retailerId");

CREATE INDEX "CampaignTargetBranch_tenantId_idx" ON "CampaignTargetBranch" ("tenantId");
CREATE INDEX "CampaignTargetBranch_campaignId_idx" ON "CampaignTargetBranch" ("campaignId");
CREATE INDEX "CampaignTargetBranch_branchId_idx" ON "CampaignTargetBranch" ("branchId");

CREATE INDEX "CampaignTargetCategory_tenantId_idx" ON "CampaignTargetCategory" ("tenantId");
CREATE INDEX "CampaignTargetCategory_campaignId_idx" ON "CampaignTargetCategory" ("campaignId");
CREATE INDEX "CampaignTargetCategory_categoryId_idx" ON "CampaignTargetCategory" ("categoryId");

CREATE INDEX "CampaignPaymentMethod_tenantId_idx" ON "CampaignPaymentMethod" ("tenantId");
CREATE INDEX "CampaignPaymentMethod_campaignId_idx" ON "CampaignPaymentMethod" ("campaignId");
CREATE INDEX "CampaignPaymentMethod_cardCodeConfigId_idx" ON "CampaignPaymentMethod" ("cardCodeConfigId");

ALTER TABLE "BankCampaignTypeConfig"
ADD CONSTRAINT "BankCampaignTypeConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Bank" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Campaign"
ADD CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Bank" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign"
ADD CONSTRAINT "Campaign_campaignTypeConfigId_fkey" FOREIGN KEY ("campaignTypeConfigId") REFERENCES "BankCampaignTypeConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign"
ADD CONSTRAINT "Campaign_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CampaignTargetRetailer"
ADD CONSTRAINT "CampaignTargetRetailer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTargetRetailer"
ADD CONSTRAINT "CampaignTargetRetailer_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Brand" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignTargetBranch"
ADD CONSTRAINT "CampaignTargetBranch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTargetBranch"
ADD CONSTRAINT "CampaignTargetBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignTargetCategory"
ADD CONSTRAINT "CampaignTargetCategory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignTargetCategory"
ADD CONSTRAINT "CampaignTargetCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignPaymentMethod"
ADD CONSTRAINT "CampaignPaymentMethod_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignPaymentMethod"
ADD CONSTRAINT "CampaignPaymentMethod_cardCodeConfigId_fkey" FOREIGN KEY ("cardCodeConfigId") REFERENCES "BankCardCodeConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "BankCampaignTypeConfig" ("id", "tenantId", "nombre", "mode", "active", "sortOrder", "createdAt", "updatedAt")
SELECT
  'ct_rpdv_' || substring(md5("id" || '_rpdv') FROM 1 FOR 24),
  "id",
  'Campana por retailers y PDV',
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  10,
  NOW(),
  NOW()
FROM "Bank";

INSERT INTO "BankCampaignTypeConfig" ("id", "tenantId", "nombre", "mode", "active", "sortOrder", "createdAt", "updatedAt")
SELECT
  'ct_rubros_' || substring(md5("id" || '_rubros') FROM 1 FOR 22),
  "id",
  'Campana por rubros',
  'RUBROS'::"CampaignTargetMode",
  true,
  20,
  NOW(),
  NOW()
FROM "Bank";
