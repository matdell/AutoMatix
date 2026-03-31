-- Add notification type for 2FA codes
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TWO_FACTOR_CODE';

-- Add 2FA fields to User
ALTER TABLE "User" ADD COLUMN "twoFactorEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorTotpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorTotpSecret" TEXT;

-- Two-factor login sessions
CREATE TABLE "TwoFactorSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailCode" TEXT,
  "emailCodeExpiresAt" TIMESTAMP(3),
  "emailCodeUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TwoFactorSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TwoFactorSession_userId_idx" ON "TwoFactorSession"("userId");
CREATE INDEX "TwoFactorSession_expiresAt_idx" ON "TwoFactorSession"("expiresAt");

ALTER TABLE "TwoFactorSession" ADD CONSTRAINT "TwoFactorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
