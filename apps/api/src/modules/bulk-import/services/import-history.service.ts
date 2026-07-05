import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ParsedRow, ImportModuleName } from '../interfaces/import.interfaces';

@Injectable()
export class ImportHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createBatch(params: {
    tenantId: string;
    uploadedById: string;
    moduleName: ImportModuleName;
    fileName: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    importMode: string;
    rows: ParsedRow[];
  }) {
    const batch = await this.prisma.bulkImportBatch.create({
      data: {
        tenantId: params.tenantId,
        uploadedById: params.uploadedById,
        moduleName: params.moduleName,
        fileName: params.fileName,
        totalRows: params.totalRows,
        validRows: params.validRows,
        invalidRows: params.invalidRows,
        importMode: params.importMode,
        status: 'PENDING',
        rows: {
          create: params.rows.map((r) => ({
            rowNumber: r.rowNumber,
            rawData: r.rawData as object,
            normalizedData: r.normalizedData ? (r.normalizedData as object) : undefined,
            rowStatus: r.isValid ? 'VALID' : 'INVALID',
            errors: r.errors.length ? (r.errors as object) : undefined,
          })),
        },
      },
    });
    return batch;
  }

  async updateBatchStatus(
    batchId: string,
    status: string,
    counts: { importedRows?: number; failedRows?: number; skippedRows?: number },
  ) {
    return this.prisma.bulkImportBatch.update({
      where: { id: batchId },
      data: {
        status: status as never,
        completedAt: new Date(),
        ...counts,
      },
    });
  }

  async markRowImported(rowId: string, createdRecordId: string) {
    return this.prisma.bulkImportRow.update({
      where: { id: rowId },
      data: { rowStatus: 'IMPORTED', createdRecordId },
    });
  }

  async markRowFailed(rowId: string, errors: string[]) {
    return this.prisma.bulkImportRow.update({
      where: { id: rowId },
      data: { rowStatus: 'FAILED', errors: errors as unknown as never },
    });
  }

  async getHistory(tenantId: string, moduleName?: string, page = 1, limit = 20) {
    const where = { tenantId, ...(moduleName ? { moduleName } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.bulkImportBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          moduleName: true,
          fileName: true,
          status: true,
          totalRows: true,
          validRows: true,
          invalidRows: true,
          importedRows: true,
          failedRows: true,
          skippedRows: true,
          importMode: true,
          createdAt: true,
          completedAt: true,
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.bulkImportBatch.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getBatchWithRows(batchId: string, tenantId: string) {
    return this.prisma.bulkImportBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        rows: { orderBy: { rowNumber: 'asc' } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getErrorRows(batchId: string, tenantId: string) {
    const batch = await this.prisma.bulkImportBatch.findFirst({
      where: { id: batchId, tenantId },
      select: { id: true },
    });
    if (!batch) return [];

    return this.prisma.bulkImportRow.findMany({
      where: { batchId, rowStatus: { in: ['INVALID', 'FAILED'] } },
      orderBy: { rowNumber: 'asc' },
    });
  }
}
