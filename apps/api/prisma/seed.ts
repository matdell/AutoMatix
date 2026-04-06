import 'dotenv/config';
import {
  CampaignCloseType,
  CampaignStatus,
  CampaignTargetMode,
  CardNetwork,
  InvitationStatus,
  MerchantStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const banco = await prisma.bank.create({
    data: {
      nombre: 'Banco Andino',
      nombreCompleto: 'Banco Andino S.A.',
      razonSocial: 'Banco Andino S.A.',
      cuit: '30-70123456-7',
      direccionCasaMatriz: 'Av. Santa Fe 1234, CABA',
      fechaAlta: new Date('2001-05-14'),
      slug: 'banco-andino',
      paymentMethods: ['Visa', 'Mastercard', 'Amex'],
      bines: ['456789', '554433'],
    },
  });

  const bancoDos = await prisma.bank.create({
    data: {
      nombre: 'Banco del Plata',
      nombreCompleto: 'Banco del Plata S.A.',
      razonSocial: 'Banco del Plata S.A.',
      cuit: '30-70111222-6',
      direccionCasaMatriz: 'Av. Libertador 850, CABA',
      fechaAlta: new Date('1998-11-02'),
      slug: 'banco-del-plata',
      paymentMethods: ['Visa', 'Maestro'],
      bines: ['404010'],
    },
  });

  const admin = await prisma.user.create({
    data: {
      tenantId: banco.id,
      email: 'admin@andino.com.ar',
      passwordHash,
      nombre: 'Lucia Gonzalez',
      role: Role.BANK_ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: banco.id,
      email: 'operaciones@andino.com.ar',
      passwordHash,
      nombre: 'Equipo Operaciones',
      role: Role.BANK_OPS,
    },
  });

  const merchantUno = await prisma.merchant.create({
    data: {
      tenantId: banco.id,
      nombre: 'Lumina Retail Group',
      categoria: 'Minorista',
      estado: MerchantStatus.ACTIVE,
      cuit: '30-71234567-2',
      merchantNumber: 'MID-9920-X1',
      contactoEmail: 'contacto@lumina.com',
      telefono: '+54 11 4444-3333',
    },
  });

  const merchantDos = await prisma.merchant.create({
    data: {
      tenantId: banco.id,
      nombre: 'Apex FinTech Hub',
      categoria: 'Tecnologia',
      estado: MerchantStatus.PENDING,
      cuit: '30-70111222-6',
      merchantNumber: 'MID-4432-A9',
      contactoEmail: 'info@apexfintech.com',
      telefono: '+54 11 5555-1212',
    },
  });

  const branchUno = await prisma.branch.create({
    data: {
      tenantId: banco.id,
      merchantId: merchantUno.id,
      nombre: 'Sucursal Central',
      direccion: 'Av. Corrientes 1234',
      ciudad: 'Buenos Aires',
      provincia: 'CABA',
      pais: 'AR',
      merchantNumber: 'MID-9920-X1',
      processor: 'Prisma Medios de Pago',
      lat: -34.6037,
      lng: -58.3816,
    },
  });

  const branchDos = await prisma.branch.create({
    data: {
      tenantId: banco.id,
      merchantId: merchantDos.id,
      nombre: 'Sucursal Norte',
      direccion: 'Av. Maipu 2500',
      ciudad: 'Vicente Lopez',
      provincia: 'Buenos Aires',
      pais: 'AR',
      merchantNumber: 'MID-4432-A9',
      processor: 'Fiserv',
      lat: -34.5292,
      lng: -58.4737,
    },
  });

  const visaConfig = await prisma.bankCardCodeConfig.create({
    data: {
      tenantId: banco.id,
      network: CardNetwork.VISA,
      label: 'Visa',
      active: true,
      sortOrder: 10,
    },
  });

  const masterConfig = await prisma.bankCardCodeConfig.create({
    data: {
      tenantId: banco.id,
      network: CardNetwork.MASTERCARD,
      label: 'Mastercard',
      active: true,
      sortOrder: 20,
    },
  });

  const campaignType = await prisma.bankCampaignTypeConfig.create({
    data: {
      tenantId: banco.id,
      nombre: 'Campana por retailers y PDV',
      mode: CampaignTargetMode.RETAILER_PDV,
      active: true,
      sortOrder: 10,
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      tenantId: banco.id,
      nombre: 'Primavera 12 Cuotas',
      campaignTypeConfigId: campaignType.id,
      closeType: CampaignCloseType.WITHOUT_CLOSE_DATE,
      estado: CampaignStatus.ACTIVE,
      fechaVigDesde: new Date('2026-09-01T00:00:00.000Z'),
      fechaVigHasta: new Date('2026-11-30T23:59:59.000Z'),
      dias: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
      condiciones: {
        cuotas: 12,
        productos: ['Indumentaria', 'Electro'],
        tope: 50000,
      },
      targetBranches: {
        create: [
          {
            tenantId: banco.id,
            branchId: branchUno.id,
          },
          {
            tenantId: banco.id,
            branchId: branchDos.id,
          },
        ],
      },
      paymentMethods: {
        create: [
          {
            tenantId: banco.id,
            cardCodeConfigId: visaConfig.id,
          },
          {
            tenantId: banco.id,
            cardCodeConfigId: masterConfig.id,
          },
        ],
      },
    },
  });

  await prisma.invitation.create({
    data: {
      tenantId: banco.id,
      email: 'nuevocomercio@correo.com',
      status: InvitationStatus.INVITED,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      branches: {
        create: [
          { tenantId: banco.id, branchId: branchUno.id },
        ],
      },
    },
  });

  await prisma.validationError.create({
    data: {
      tenantId: banco.id,
      merchantId: merchantDos.id,
      codigo: 'MID_INVALIDO',
      mensaje: 'El numero de comercio no cumple el formato requerido.',
    },
  });

  await prisma.notification.create({
    data: {
      tenantId: banco.id,
      tipo: 'INVITATION',
      destino: 'nuevocomercio@correo.com',
      estado: 'ENVIADO',
      payload: { campaignId: campaign.id },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: bancoDos.id,
      email: 'admin@plata.com.ar',
      passwordHash,
      nombre: 'Mariano Lopez',
      role: Role.BANK_ADMIN,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: banco.id,
      userId: admin.id,
      action: 'CREATE',
      entity: 'Campaign',
      entityId: campaign.id,
      after: { nombre: campaign.nombre },
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
