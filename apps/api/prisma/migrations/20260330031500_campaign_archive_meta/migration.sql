-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "archivedById" TEXT;

-- CreateIndex
CREATE INDEX "Campaign_archivedById_idx" ON "Campaign"("archivedById");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
