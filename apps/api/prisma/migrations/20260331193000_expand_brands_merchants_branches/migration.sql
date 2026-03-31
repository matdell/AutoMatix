-- CreateEnum
CREATE TYPE "CardNetwork" AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'CABAL', 'NARANJA', 'OTRA');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "sitioWeb" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "emailPrincipal" TEXT,
ADD COLUMN     "telefonoPrincipal" TEXT,
ADD COLUMN     "processor" TEXT;

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "direccionSocial" TEXT,
ADD COLUMN     "processor" TEXT;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "calle" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "piso" TEXT,
ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "shoppingId" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shopping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shopping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchEstablishment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cardNetwork" "CardNetwork" NOT NULL,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchEstablishment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_nombre_key" ON "Category"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCategory_brandId_categoryId_key" ON "BrandCategory"("brandId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Shopping_tenantId_nombre_key" ON "Shopping"("tenantId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "BranchEstablishment_branchId_cardNetwork_key" ON "BranchEstablishment"("branchId", "cardNetwork");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE INDEX "BrandCategory_tenantId_idx" ON "BrandCategory"("tenantId");

-- CreateIndex
CREATE INDEX "BrandCategory_brandId_idx" ON "BrandCategory"("brandId");

-- CreateIndex
CREATE INDEX "BrandCategory_categoryId_idx" ON "BrandCategory"("categoryId");

-- CreateIndex
CREATE INDEX "Shopping_tenantId_idx" ON "Shopping"("tenantId");

-- CreateIndex
CREATE INDEX "BranchEstablishment_tenantId_idx" ON "BranchEstablishment"("tenantId");

-- CreateIndex
CREATE INDEX "BranchEstablishment_branchId_idx" ON "BranchEstablishment"("branchId");

-- CreateIndex
CREATE INDEX "Branch_shoppingId_idx" ON "Branch"("shoppingId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandCategory" ADD CONSTRAINT "BrandCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shopping" ADD CONSTRAINT "Shopping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_shoppingId_fkey" FOREIGN KEY ("shoppingId") REFERENCES "Shopping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchEstablishment" ADD CONSTRAINT "BranchEstablishment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchEstablishment" ADD CONSTRAINT "BranchEstablishment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
