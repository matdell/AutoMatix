import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBankBranchDto } from './dto/create-bank-branch.dto';
import { UpdateBankBranchDto } from './dto/update-bank-branch.dto';

@Injectable()
export class BankBranchesService {
  constructor(private prisma: PrismaService) {}

  async list(bankId: string) {
    return this.prisma.bankBranch.findMany({
      where: { bankId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(bankId: string, dto: CreateBankBranchDto) {
    return this.prisma.bankBranch.create({
      data: {
        bankId,
        nombre: dto.nombre,
        codigo: dto.codigo ?? null,
        localidad: dto.localidad ?? null,
        region: dto.region ?? null,
        tipo: dto.tipo ?? null,
        direccion: dto.direccion ?? null,
      },
    });
  }

  async update(bankId: string, id: string, dto: UpdateBankBranchDto) {
    const branch = await this.prisma.bankBranch.findFirst({
      where: { id, bankId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    return this.prisma.bankBranch.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        codigo: dto.codigo ?? undefined,
        localidad: dto.localidad ?? undefined,
        region: dto.region ?? undefined,
        tipo: dto.tipo ?? undefined,
        direccion: dto.direccion ?? undefined,
        activo: dto.activo ?? undefined,
      },
    });
  }

  async remove(bankId: string, id: string) {
    const branch = await this.prisma.bankBranch.findFirst({
      where: { id, bankId },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada');
    }

    const assignedUsers = await this.prisma.user.count({
      where: {
        tenantId: bankId,
        bankBranchId: id,
      },
    });

    if (assignedUsers > 0) {
      throw new BadRequestException(
        'No se puede eliminar la sucursal porque tiene usuarios asociados. Reasignalos o desactiva la sucursal.',
      );
    }

    await this.prisma.bankBranch.delete({ where: { id } });
    return { ok: true };
  }
}
