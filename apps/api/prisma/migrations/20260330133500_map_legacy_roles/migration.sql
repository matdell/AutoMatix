UPDATE "User" SET "role" = 'BANK_ADMIN' WHERE "role" = 'ADMIN';
UPDATE "User" SET "role" = 'BANK_OPS' WHERE "role" = 'OPERATIONS';
UPDATE "User" SET "role" = 'MERCHANT_USER' WHERE "role" = 'MERCHANT';
