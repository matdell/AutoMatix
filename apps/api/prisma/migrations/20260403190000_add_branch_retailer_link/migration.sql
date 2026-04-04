-- Add retailer (brand) linkage to PDV/Branch
ALTER TABLE "Branch"
ADD COLUMN "retailerId" TEXT;

-- Backfill when merchant has exactly one linked retailer
UPDATE "Branch" AS b
SET "retailerId" = single_link."brandId"
FROM (
  SELECT "merchantId", MIN("brandId") AS "brandId"
  FROM "BrandLegalEntity"
  GROUP BY "merchantId"
  HAVING COUNT(*) = 1
) AS single_link
WHERE b."merchantId" = single_link."merchantId"
  AND b."retailerId" IS NULL;

CREATE INDEX "Branch_retailerId_idx" ON "Branch"("retailerId");

ALTER TABLE "Branch"
ADD CONSTRAINT "Branch_retailerId_fkey"
FOREIGN KEY ("retailerId") REFERENCES "Brand"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
