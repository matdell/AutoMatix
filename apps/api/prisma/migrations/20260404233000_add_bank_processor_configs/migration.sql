-- Configurable processor options by bank
CREATE TABLE "BankProcessorConfig" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankProcessorConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankProcessorConfig_tenantId_nombre_key" ON "BankProcessorConfig"("tenantId", "nombre");
CREATE INDEX "BankProcessorConfig_tenantId_idx" ON "BankProcessorConfig"("tenantId");
CREATE INDEX "BankProcessorConfig_tenantId_active_idx" ON "BankProcessorConfig"("tenantId", "active");

ALTER TABLE "BankProcessorConfig"
ADD CONSTRAINT "BankProcessorConfig_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Bank"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
