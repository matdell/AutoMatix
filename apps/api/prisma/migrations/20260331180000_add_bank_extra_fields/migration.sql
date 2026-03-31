-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "nombreCompleto" TEXT,
ADD COLUMN     "razonSocial" TEXT,
ADD COLUMN     "cuit" TEXT,
ADD COLUMN     "direccionCasaMatriz" TEXT,
ADD COLUMN     "fechaAlta" TIMESTAMP(3);
