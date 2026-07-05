import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateFormDto {
  name: string;
  description?: string;
  fields: {
    id: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    placeholder?: string;
    order: number;
  }[];
}

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.form.findMany({
      where: { tenantId },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id, tenantId },
      include: { responses: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async create(dto: CreateFormDto, tenantId: string, createdBy: string) {
    return this.prisma.form.create({
      data: {
        tenantId,
        createdBy,
        name: dto.name,
        description: dto.description,
        fields: dto.fields as any,
        isActive: true,
      },
    });
  }

  async update(id: string, dto: Partial<CreateFormDto>, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.prisma.form.update({ where: { id }, data: dto as any });
  }

  async submit(
    formId: string,
    refType: string,
    refId: string,
    submittedBy: string,
    responses: Record<string, any>,
  ) {
    const form = await this.prisma.form.findFirst({ where: { id: formId } });
    if (!form) throw new NotFoundException('Form not found');
    return this.prisma.formResponse.create({
      data: { formId, refType, refId, submittedBy, responses },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.form.delete({ where: { id } });
    return { message: 'Form deleted' };
  }
}
