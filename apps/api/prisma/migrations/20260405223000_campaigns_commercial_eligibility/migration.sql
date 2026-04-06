DO $$
BEGIN
  CREATE TYPE "CampaignBenefitType" AS ENUM (
    'DISCOUNT',
    'INSTALLMENTS',
    'INSTALLMENTS_DISCOUNT',
    'CASHBACK',
    'FINANCING',
    'BANK_CREDENTIAL'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

DO $$
BEGIN
  CREATE TYPE "CampaignCommercialStatus" AS ENUM (
    'INVITACION',
    'OPERACIONES',
    'ADMINISTRADORA',
    'PARCIAL',
    'OK'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

DO $$
BEGIN
  CREATE TYPE "CampaignAdhesionStatus" AS ENUM (
    'PENDIENTE',
    'ACEPTADA',
    'RECHAZADA'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

ALTER TABLE "BankCampaignTypeConfig"
  ADD COLUMN IF NOT EXISTS "benefitType" "CampaignBenefitType",
  ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT false;

UPDATE "BankCampaignTypeConfig"
SET "benefitType" = CASE
  WHEN lower("nombre") LIKE '%cashback%' THEN 'CASHBACK'::"CampaignBenefitType"
  WHEN lower("nombre") LIKE '%financi%' THEN 'FINANCING'::"CampaignBenefitType"
  WHEN lower("nombre") LIKE '%credencial%' OR lower("nombre") LIKE '%fstp%' OR lower("nombre") LIKE '%100% banco%' THEN 'BANK_CREDENTIAL'::"CampaignBenefitType"
  WHEN lower("nombre") LIKE '%cuota%' AND lower("nombre") LIKE '%descuent%' THEN 'INSTALLMENTS_DISCOUNT'::"CampaignBenefitType"
  WHEN lower("nombre") LIKE '%cuota%' THEN 'INSTALLMENTS'::"CampaignBenefitType"
  ELSE 'DISCOUNT'::"CampaignBenefitType"
END
WHERE "benefitType" IS NULL;

ALTER TABLE "BankCampaignTypeConfig"
  ALTER COLUMN "benefitType" SET DEFAULT 'DISCOUNT',
  ALTER COLUMN "benefitType" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "BankCampaignTypeConfig_tenantId_benefitType_idx"
  ON "BankCampaignTypeConfig" ("tenantId", "benefitType");

WITH preferred AS (
  SELECT DISTINCT ON ("tenantId") "id", "tenantId"
  FROM "BankCampaignTypeConfig"
  WHERE "benefitType" = 'DISCOUNT'::"CampaignBenefitType"
  ORDER BY "tenantId", "locked" DESC, "sortOrder" ASC, "createdAt" ASC
)
UPDATE "BankCampaignTypeConfig" c
SET "locked" = true, "sortOrder" = 10
FROM preferred p
WHERE c."id" = p."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "BankCampaignTypeConfig" e
    WHERE e."tenantId" = p."tenantId"
      AND e."benefitType" = 'DISCOUNT'::"CampaignBenefitType"
      AND e."locked" = true
  );

WITH preferred AS (
  SELECT DISTINCT ON ("tenantId") "id", "tenantId"
  FROM "BankCampaignTypeConfig"
  WHERE "benefitType" = 'INSTALLMENTS'::"CampaignBenefitType"
  ORDER BY "tenantId", "locked" DESC, "sortOrder" ASC, "createdAt" ASC
)
UPDATE "BankCampaignTypeConfig" c
SET "locked" = true, "sortOrder" = 20
FROM preferred p
WHERE c."id" = p."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "BankCampaignTypeConfig" e
    WHERE e."tenantId" = p."tenantId"
      AND e."benefitType" = 'INSTALLMENTS'::"CampaignBenefitType"
      AND e."locked" = true
  );

WITH preferred AS (
  SELECT DISTINCT ON ("tenantId") "id", "tenantId"
  FROM "BankCampaignTypeConfig"
  WHERE "benefitType" = 'INSTALLMENTS_DISCOUNT'::"CampaignBenefitType"
  ORDER BY "tenantId", "locked" DESC, "sortOrder" ASC, "createdAt" ASC
)
UPDATE "BankCampaignTypeConfig" c
SET "locked" = true, "sortOrder" = 30
FROM preferred p
WHERE c."id" = p."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "BankCampaignTypeConfig" e
    WHERE e."tenantId" = p."tenantId"
      AND e."benefitType" = 'INSTALLMENTS_DISCOUNT'::"CampaignBenefitType"
      AND e."locked" = true
  );

WITH preferred AS (
  SELECT DISTINCT ON ("tenantId") "id", "tenantId"
  FROM "BankCampaignTypeConfig"
  WHERE "benefitType" = 'CASHBACK'::"CampaignBenefitType"
  ORDER BY "tenantId", "locked" DESC, "sortOrder" ASC, "createdAt" ASC
)
UPDATE "BankCampaignTypeConfig" c
SET "locked" = true, "sortOrder" = 40
FROM preferred p
WHERE c."id" = p."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "BankCampaignTypeConfig" e
    WHERE e."tenantId" = p."tenantId"
      AND e."benefitType" = 'CASHBACK'::"CampaignBenefitType"
      AND e."locked" = true
  );

WITH preferred AS (
  SELECT DISTINCT ON ("tenantId") "id", "tenantId"
  FROM "BankCampaignTypeConfig"
  WHERE "benefitType" = 'FINANCING'::"CampaignBenefitType"
  ORDER BY "tenantId", "locked" DESC, "sortOrder" ASC, "createdAt" ASC
)
UPDATE "BankCampaignTypeConfig" c
SET "locked" = true, "sortOrder" = 50
FROM preferred p
WHERE c."id" = p."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "BankCampaignTypeConfig" e
    WHERE e."tenantId" = p."tenantId"
      AND e."benefitType" = 'FINANCING'::"CampaignBenefitType"
      AND e."locked" = true
  );

WITH preferred AS (
  SELECT DISTINCT ON ("tenantId") "id", "tenantId"
  FROM "BankCampaignTypeConfig"
  WHERE "benefitType" = 'BANK_CREDENTIAL'::"CampaignBenefitType"
  ORDER BY "tenantId", "locked" DESC, "sortOrder" ASC, "createdAt" ASC
)
UPDATE "BankCampaignTypeConfig" c
SET "locked" = true, "sortOrder" = 60
FROM preferred p
WHERE c."id" = p."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "BankCampaignTypeConfig" e
    WHERE e."tenantId" = p."tenantId"
      AND e."benefitType" = 'BANK_CREDENTIAL'::"CampaignBenefitType"
      AND e."locked" = true
  );

INSERT INTO "BankCampaignTypeConfig" (
  "id", "tenantId", "nombre", "benefitType", "mode", "locked", "active", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'ct_discount_' || substring(md5("id" || '_discount') FROM 1 FOR 18),
  "id",
  'Descuento',
  'DISCOUNT'::"CampaignBenefitType",
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  true,
  10,
  NOW(),
  NOW()
FROM "Bank" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BankCampaignTypeConfig" c
  WHERE c."tenantId" = b."id"
    AND c."benefitType" = 'DISCOUNT'::"CampaignBenefitType"
    AND c."locked" = true
);

INSERT INTO "BankCampaignTypeConfig" (
  "id", "tenantId", "nombre", "benefitType", "mode", "locked", "active", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'ct_installments_' || substring(md5("id" || '_installments') FROM 1 FOR 14),
  "id",
  'Cuotas',
  'INSTALLMENTS'::"CampaignBenefitType",
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  true,
  20,
  NOW(),
  NOW()
FROM "Bank" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BankCampaignTypeConfig" c
  WHERE c."tenantId" = b."id"
    AND c."benefitType" = 'INSTALLMENTS'::"CampaignBenefitType"
    AND c."locked" = true
);

INSERT INTO "BankCampaignTypeConfig" (
  "id", "tenantId", "nombre", "benefitType", "mode", "locked", "active", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'ct_inst_discount_' || substring(md5("id" || '_inst_discount') FROM 1 FOR 12),
  "id",
  'Cuotas + Descuento',
  'INSTALLMENTS_DISCOUNT'::"CampaignBenefitType",
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  true,
  30,
  NOW(),
  NOW()
FROM "Bank" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BankCampaignTypeConfig" c
  WHERE c."tenantId" = b."id"
    AND c."benefitType" = 'INSTALLMENTS_DISCOUNT'::"CampaignBenefitType"
    AND c."locked" = true
);

INSERT INTO "BankCampaignTypeConfig" (
  "id", "tenantId", "nombre", "benefitType", "mode", "locked", "active", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'ct_cashback_' || substring(md5("id" || '_cashback') FROM 1 FOR 18),
  "id",
  'Cashback',
  'CASHBACK'::"CampaignBenefitType",
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  true,
  40,
  NOW(),
  NOW()
FROM "Bank" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BankCampaignTypeConfig" c
  WHERE c."tenantId" = b."id"
    AND c."benefitType" = 'CASHBACK'::"CampaignBenefitType"
    AND c."locked" = true
);

INSERT INTO "BankCampaignTypeConfig" (
  "id", "tenantId", "nombre", "benefitType", "mode", "locked", "active", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'ct_financing_' || substring(md5("id" || '_financing') FROM 1 FOR 17),
  "id",
  'Financiacion',
  'FINANCING'::"CampaignBenefitType",
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  true,
  50,
  NOW(),
  NOW()
FROM "Bank" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BankCampaignTypeConfig" c
  WHERE c."tenantId" = b."id"
    AND c."benefitType" = 'FINANCING'::"CampaignBenefitType"
    AND c."locked" = true
);

INSERT INTO "BankCampaignTypeConfig" (
  "id", "tenantId", "nombre", "benefitType", "mode", "locked", "active", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'ct_cred_' || substring(md5("id" || '_credential') FROM 1 FOR 21),
  "id",
  'Credencial / 100% aporte banco',
  'BANK_CREDENTIAL'::"CampaignBenefitType",
  'RETAILER_PDV'::"CampaignTargetMode",
  true,
  true,
  60,
  NOW(),
  NOW()
FROM "Bank" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "BankCampaignTypeConfig" c
  WHERE c."tenantId" = b."id"
    AND c."benefitType" = 'BANK_CREDENTIAL'::"CampaignBenefitType"
    AND c."locked" = true
);

ALTER TABLE "Campaign"
  ADD COLUMN IF NOT EXISTS "commercialStatus" "CampaignCommercialStatus" NOT NULL DEFAULT 'INVITACION',
  ADD COLUMN IF NOT EXISTS "codigoInterno" TEXT,
  ADD COLUMN IF NOT EXISTS "codigoExterno" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibility" JSONB,
  ADD COLUMN IF NOT EXISTS "resolvedBines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "Campaign_tenantId_commercialStatus_idx"
  ON "Campaign" ("tenantId", "commercialStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "Campaign_tenantId_codigoInterno_key"
  ON "Campaign" ("tenantId", "codigoInterno");

CREATE TABLE IF NOT EXISTS "CampaignProcessorCode" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "processor" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignProcessorCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignProcessorCode_campaignId_processor_code_key"
  ON "CampaignProcessorCode" ("campaignId", "processor", "code");

CREATE INDEX IF NOT EXISTS "CampaignProcessorCode_tenantId_idx"
  ON "CampaignProcessorCode" ("tenantId");

CREATE INDEX IF NOT EXISTS "CampaignProcessorCode_campaignId_idx"
  ON "CampaignProcessorCode" ("campaignId");

DO $$
BEGIN
  ALTER TABLE "CampaignProcessorCode"
    ADD CONSTRAINT "CampaignProcessorCode_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

CREATE TABLE IF NOT EXISTS "CampaignMerchantAdhesion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "status" "CampaignAdhesionStatus" NOT NULL DEFAULT 'PENDIENTE',
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignMerchantAdhesion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignMerchantAdhesion_campaignId_merchantId_key"
  ON "CampaignMerchantAdhesion" ("campaignId", "merchantId");

CREATE INDEX IF NOT EXISTS "CampaignMerchantAdhesion_tenantId_idx"
  ON "CampaignMerchantAdhesion" ("tenantId");

CREATE INDEX IF NOT EXISTS "CampaignMerchantAdhesion_campaignId_idx"
  ON "CampaignMerchantAdhesion" ("campaignId");

CREATE INDEX IF NOT EXISTS "CampaignMerchantAdhesion_merchantId_idx"
  ON "CampaignMerchantAdhesion" ("merchantId");

CREATE INDEX IF NOT EXISTS "CampaignMerchantAdhesion_tenantId_status_idx"
  ON "CampaignMerchantAdhesion" ("tenantId", "status");

DO $$
BEGIN
  ALTER TABLE "CampaignMerchantAdhesion"
    ADD CONSTRAINT "CampaignMerchantAdhesion_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

DO $$
BEGIN
  ALTER TABLE "CampaignMerchantAdhesion"
    ADD CONSTRAINT "CampaignMerchantAdhesion_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;

CREATE TABLE IF NOT EXISTS "BankBinConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bin" TEXT NOT NULL,
  "network" TEXT NOT NULL,
  "cardType" TEXT NOT NULL,
  "segment" TEXT,
  "alliance" TEXT,
  "channel" TEXT,
  "product" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BankBinConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankBinConfig_tenantId_bin_key"
  ON "BankBinConfig" ("tenantId", "bin");

CREATE INDEX IF NOT EXISTS "BankBinConfig_tenantId_idx"
  ON "BankBinConfig" ("tenantId");

CREATE INDEX IF NOT EXISTS "BankBinConfig_tenantId_active_idx"
  ON "BankBinConfig" ("tenantId", "active");

CREATE INDEX IF NOT EXISTS "BankBinConfig_tenantId_network_idx"
  ON "BankBinConfig" ("tenantId", "network");

CREATE INDEX IF NOT EXISTS "BankBinConfig_tenantId_cardType_idx"
  ON "BankBinConfig" ("tenantId", "cardType");

CREATE INDEX IF NOT EXISTS "BankBinConfig_tenantId_segment_idx"
  ON "BankBinConfig" ("tenantId", "segment");

CREATE INDEX IF NOT EXISTS "BankBinConfig_tenantId_alliance_idx"
  ON "BankBinConfig" ("tenantId", "alliance");

DO $$
BEGIN
  ALTER TABLE "BankBinConfig"
    ADD CONSTRAINT "BankBinConfig_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;
