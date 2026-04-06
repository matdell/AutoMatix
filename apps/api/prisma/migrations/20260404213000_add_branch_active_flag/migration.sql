ALTER TABLE "Branch"
ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Branch_tenantId_activo_idx" ON "Branch"("tenantId", "activo");
