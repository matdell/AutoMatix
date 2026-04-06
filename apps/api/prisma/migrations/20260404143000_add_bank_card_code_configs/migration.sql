-- Configurable card-code fields by bank
CREATE TABLE "BankCardCodeConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "network" "CardNetwork" NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankCardCodeConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankCardCodeConfig_tenantId_network_key" ON "BankCardCodeConfig"("tenantId", "network");
CREATE INDEX "BankCardCodeConfig_tenantId_idx" ON "BankCardCodeConfig"("tenantId");
CREATE INDEX "BankCardCodeConfig_tenantId_active_idx" ON "BankCardCodeConfig"("tenantId", "active");

ALTER TABLE "BankCardCodeConfig"
ADD CONSTRAINT "BankCardCodeConfig_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Bank"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
