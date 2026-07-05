import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BulkImportController } from './bulk-import.controller';
import { BulkImportService } from './services/bulk-import.service';
import { ExcelTemplateService } from './services/excel-template.service';
import { ExcelParserService } from './services/excel-parser.service';
import { ImportValidationService } from './services/import-validation.service';
import { ImportHistoryService } from './services/import-history.service';
import { DelegationImporter } from './services/importers/delegation.importer';
import { WorkRequestImporter } from './services/importers/work-request.importer';
import { ChecklistImporter } from './services/importers/checklist.importer';
import { FmsImporter } from './services/importers/fms.importer';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [BulkImportController],
  providers: [
    BulkImportService,
    ExcelTemplateService,
    ExcelParserService,
    ImportValidationService,
    ImportHistoryService,
    DelegationImporter,
    WorkRequestImporter,
    ChecklistImporter,
    FmsImporter,
  ],
})
export class BulkImportModule {}
