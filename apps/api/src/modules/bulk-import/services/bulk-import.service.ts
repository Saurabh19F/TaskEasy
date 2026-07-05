import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExcelTemplateService } from './excel-template.service';
import { ExcelParserService } from './excel-parser.service';
import { ImportValidationService } from './import-validation.service';
import { ImportHistoryService } from './import-history.service';
import { DelegationImporter } from './importers/delegation.importer';
import { WorkRequestImporter } from './importers/work-request.importer';
import { ChecklistImporter } from './importers/checklist.importer';
import { FmsImporter } from './importers/fms.importer';
import { MODULE_CONFIGS } from '../configs/module.configs';
import { ImportModuleName, ImportMode, ValidationResult, ImportResult } from '../interfaces/import.interfaces';

@Injectable()
export class BulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: ExcelTemplateService,
    private readonly parserService: ExcelParserService,
    private readonly validationService: ImportValidationService,
    private readonly historyService: ImportHistoryService,
    private readonly delegationImporter: DelegationImporter,
    private readonly workRequestImporter: WorkRequestImporter,
    private readonly checklistImporter: ChecklistImporter,
    private readonly fmsImporter: FmsImporter,
  ) {}

  getConfig(moduleName: ImportModuleName) {
    const config = MODULE_CONFIGS[moduleName];
    if (!config) throw new BadRequestException(`Unknown import module: ${moduleName}`);
    return config;
  }

  async generateTemplate(moduleName: ImportModuleName, tenantId: string): Promise<Buffer> {
    const config = this.getConfig(moduleName);

    const [users, projects] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { name: true, email: true },
        orderBy: { name: 'asc' },
      }),
      moduleName === 'delegation'
        ? this.prisma.project.findMany({
            where: { tenantId },
            select: { name: true },
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    return this.templateService.generate(config, {
      users: users.map((u) => ({ name: u.name, email: u.email })),
      projects: projects.map((p) => p.name),
    });
  }

  async validateFile(
    moduleName: ImportModuleName,
    fileBuffer: Buffer,
    fileName: string,
    tenantId: string,
    uploadedById: string,
    importMode: ImportMode = 'valid_only',
  ): Promise<ValidationResult> {
    const config = this.getConfig(moduleName);
    const parsedRows = this.parserService.parse(fileBuffer, config);

    if (parsedRows.length === 0) {
      throw new BadRequestException('No data rows found in the file.');
    }

    const validated = await this.validationService.validate(parsedRows, config, tenantId);
    const validCount = validated.filter((r) => r.isValid).length;
    const invalidCount = validated.filter((r) => !r.isValid).length;

    const batch = await this.historyService.createBatch({
      tenantId,
      uploadedById,
      moduleName,
      fileName,
      totalRows: validated.length,
      validRows: validCount,
      invalidRows: invalidCount,
      importMode,
      rows: validated,
    });

    return {
      batchId: batch.id,
      totalRows: validated.length,
      validRows: validCount,
      invalidRows: invalidCount,
      rows: validated,
    };
  }

  async importBatch(
    batchId: string,
    tenantId: string,
    uploadedById: string,
  ): Promise<ImportResult> {
    const batchRaw = await this.historyService.getBatchWithRows(batchId, tenantId);
    if (!batchRaw) throw new NotFoundException('Import batch not found');
    const batch = batchRaw as typeof batchRaw & { rows: { id: string; rowNumber: number; rowStatus: string; rawData: unknown; normalizedData: unknown; errors: unknown }[] };
    if (batch.status !== 'PENDING') {
      throw new BadRequestException(`Batch is already in status: ${batch.status}`);
    }

    await this.historyService.updateBatchStatus(batchId, 'IMPORTING', {});

    const config = this.getConfig(batch.moduleName as ImportModuleName);
    const importMode = batch.importMode as ImportMode;

    const validRows = batch.rows.filter((r) => r.rowStatus === 'VALID');
    const skippedRows = batch.rows.filter((r) => r.rowStatus === 'INVALID');

    if (importMode === 'stop_on_error' && skippedRows.length > 0) {
      await this.historyService.updateBatchStatus(batchId, 'FAILED', {
        importedRows: 0,
        failedRows: 0,
        skippedRows: skippedRows.length,
      });
      throw new BadRequestException(`Import stopped: ${skippedRows.length} invalid rows found. Fix errors and re-upload.`);
    }

    let importedCount = 0;
    let failedCount = 0;

    const parsedValid = validRows.map((r) => ({
      rowNumber: r.rowNumber,
      rawData: r.rawData as Record<string, unknown>,
      normalizedData: r.normalizedData as Record<string, unknown>,
      errors: (r.errors as string[]) ?? [],
      isValid: true,
    }));

    if (config.moduleName === 'checklist') {
      try {
        const results = await this.checklistImporter.importRows(parsedValid, tenantId, uploadedById);
        importedCount = results.length;
        for (const r of results) {
          const dbRow = validRows.find((row) => row.rowNumber === parseInt(r.rowId, 10));
          if (dbRow) await this.historyService.markRowImported(dbRow.id, r.recordId);
        }
      } catch (e) {
        failedCount = validRows.length;
      }
    } else if (config.moduleName === 'fms') {
      try {
        const results = await this.fmsImporter.importRows(parsedValid, tenantId, uploadedById);
        importedCount = results.length;
        for (const r of results) {
          const dbRow = validRows.find((row) => row.rowNumber === parseInt(r.rowId, 10));
          if (dbRow) await this.historyService.markRowImported(dbRow.id, r.recordId);
        }
      } catch (e) {
        failedCount = validRows.length;
      }
    } else {
      for (const row of parsedValid) {
        const dbRow = validRows.find((r) => r.rowNumber === row.rowNumber);
        try {
          let recordId: string;
          if (config.moduleName === 'delegation') {
            recordId = await this.delegationImporter.importRow(row, tenantId, uploadedById);
          } else {
            recordId = await this.workRequestImporter.importRow(row, tenantId, uploadedById);
          }
          importedCount++;
          if (dbRow) await this.historyService.markRowImported(dbRow.id, recordId);
        } catch (e) {
          failedCount++;
          if (dbRow) await this.historyService.markRowFailed(dbRow.id, [(e as Error).message]);
        }
      }
    }

    const finalStatus =
      failedCount === 0 ? 'COMPLETED' : importedCount > 0 ? 'PARTIAL' : 'FAILED';

    await this.historyService.updateBatchStatus(batchId, finalStatus, {
      importedRows: importedCount,
      failedRows: failedCount,
      skippedRows: skippedRows.length,
    });

    return {
      batchId,
      totalRows: batch.totalRows,
      importedRows: importedCount,
      failedRows: failedCount,
      skippedRows: skippedRows.length,
      status: finalStatus,
    };
  }

  async generateErrorReport(batchId: string, tenantId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const errorRows = await this.historyService.getErrorRows(batchId, tenantId);
    if (errorRows.length === 0) throw new BadRequestException('No error rows found for this batch');

    const batch = await this.historyService.getBatchWithRows(batchId, tenantId);
    if (!batch) throw new NotFoundException('Batch not found');

    const config = this.getConfig(batch.moduleName as ImportModuleName);

    const rows = errorRows.map((r) => ({
      rowNumber: r.rowNumber,
      rawData: r.rawData as Record<string, unknown>,
      errors: (r.errors as string[]) ?? [],
    }));

    const buffer = this.templateService.generateErrorReport(config, rows);
    const fileName = `errors-${batch.moduleName}-${batchId.slice(-6)}.xlsx`;
    return { buffer, fileName };
  }
}
