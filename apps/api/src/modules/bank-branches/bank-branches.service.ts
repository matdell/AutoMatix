import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBankBranchDto } from './dto/create-bank-branch.dto';

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
      },
    });
  }
}
