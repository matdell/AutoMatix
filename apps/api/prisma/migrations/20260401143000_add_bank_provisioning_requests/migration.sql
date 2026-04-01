DO $$
BEGIN
  CREATE TYPE "ProvisioningTarget" AS ENUM ('VPS_MANAGED', 'CUSTOMER_CLOUD', 'ON_PREM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ProvisioningStatus" AS ENUM ('REQUESTED', 'RUNNING', 'READY', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "BankProvisioningRequest" (
  "id" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "target" "ProvisioningTarget" NOT NULL,
  "status" "ProvisioningStatus" NOT NULL DEFAULT 'REQUESTED',
  "provider" TEXT,
  "domain" TEXT,
  "apiDomain" TEXT,
  "region" TEXT,
  "config" JSONB,
  "credentials" JSONB,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BankProvisioningRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankProvisioningRequest_bankId_idx" ON "BankProvisioningRequest"("bankId");
CREATE INDEX IF NOT EXISTS "BankProvisioningRequest_status_idx" ON "BankProvisioningRequest"("status");
CREATE INDEX IF NOT EXISTS "BankProvisioningRequest_createdAt_idx" ON "BankProvisioningRequest"("createdAt");

DO $$
BEGIN
  ALTER TABLE "BankProvisioningRequest"
  ADD CONSTRAINT "BankProvisioningRequest_bankId_fkey"
  FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

