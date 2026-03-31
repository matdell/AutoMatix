-- Add activo flag to Bank
ALTER TABLE "Bank" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;
