-- AlterTable
ALTER TABLE "Shopping"
ADD COLUMN "grupo" TEXT;

-- CreateIndex
CREATE INDEX "Shopping_tenantId_grupo_idx" ON "Shopping"("tenantId", "grupo");
