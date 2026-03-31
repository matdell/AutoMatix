import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const nombre = process.env.SUPERADMIN_NAME || 'Super Admin';
  const bankName = process.env.SUPERADMIN_BANK_NAME || 'AutoMatix Platform';
  const bankSlug = process.env.SUPERADMIN_BANK_SLUG || 'automatrix-platform';

  if (!email || !password) {
    throw new Error('SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD son obligatorios');
  }

  const bank = await prisma.bank.upsert({
    where: { slug: bankSlug },
    update: { nombre: bankName },
    create: {
      nombre: bankName,
      slug: bankSlug,
      paymentMethods: [],
      bines: [],
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findFirst({
    where: { tenantId: bank.id, email },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        nombre,
        passwordHash,
        role: Role.SUPERADMIN,
        isActive: true,
      },
    });
    console.log(`SuperAdmin actualizado: ${email}`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: bank.id,
        email,
        passwordHash,
        nombre,
        role: Role.SUPERADMIN,
        isActive: true,
      },
    });
    console.log(`SuperAdmin creado: ${email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
