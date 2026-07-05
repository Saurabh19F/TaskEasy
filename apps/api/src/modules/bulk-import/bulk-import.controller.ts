import {
  Controller, Get, Post, Param, Query, Res,
  UseGuards, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { BulkImportService } from './services/bulk-import.service';
import { ImportModuleName, ImportMode } from './interfaces/import.interfaces';
import { MODULE_CONFIGS } from './configs/module.configs';

const ALLOWED_MODULES: ImportModuleName[] = ['delegation', 'workRequest', 'checklist', 'fms'];

function permissionFor(moduleName: string): string {
  const cfg = MODULE_CONFIGS[moduleName];
  return cfg?.requiredPermission ?? 'bulkImport.history';
}

@ApiTags('Bulk Import')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('bulk-import')
export class BulkImportController {
  constructor(private readonly bulkImportService: BulkImportService) {}

  @Get('modules')
  @RequirePermissions('bulkImport.history')
  listModules() {
    return Object.values(MODULE_CONFIGS).map(({ moduleName, label, columns, maxRows }) => ({
      moduleName,
      label,
      maxRows,
      requiredPermission: MODULE_CONFIGS[moduleName].requiredPermission,
      columns: columns.map(({ key, header, required, type, enumValues, description, example }) => ({
        key, header, required, type, enumValues, description, example,
      })),
    }));
  }

  @Get('templates/:module')
  async downloadTemplate(
    @Param('module') moduleName: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    if (!ALLOWED_MODULES.includes(moduleName as ImportModuleName)) {
      throw new BadRequestException(`Invalid module: ${moduleName}`);
    }

    const buffer = await this.bulkImportService.generateTemplate(moduleName as ImportModuleName, user.tenantId);
    const config = MODULE_CONFIGS[moduleName];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${config.label.replace(/\s+/g, '_')}_Template.xlsx"`);
    res.send(buffer);
  }

  @Post('validate/:module')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, mode: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async validate(
    @Param('module') moduleName: string,
    @Query('mode') mode: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!ALLOWED_MODULES.includes(moduleName as ImportModuleName)) {
      throw new BadRequestException(`Invalid module: ${moduleName}`);
    }

    const importMode = (mode === 'stop_on_error' ? 'stop_on_error' : 'valid_only') as ImportMode;
    return this.bulkImportService.validateFile(
      moduleName as ImportModuleName,
      file.buffer,
      file.originalname,
      user.tenantId,
      user.sub,
      importMode,
    );
  }

  @Post('import/:batchId')
  async importBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bulkImportService.importBatch(batchId, user.tenantId, user.sub);
  }

  @Get('history')
  @RequirePermissions('bulkImport.history')
  getHistory(
    @Query('module') module: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const moduleName = ALLOWED_MODULES.includes(module as ImportModuleName) ? module : undefined;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    return this.bulkImportService['historyService'].getHistory(user.tenantId, moduleName, p, l);
  }

  @Get('batch/:batchId')
  @RequirePermissions('bulkImport.history')
  getBatch(@Param('batchId') batchId: string, @CurrentUser() user: JwtPayload) {
    return this.bulkImportService['historyService'].getBatchWithRows(batchId, user.tenantId);
  }

  @Get('errors/:batchId')
  @RequirePermissions('bulkImport.history')
  async downloadErrorReport(
    @Param('batchId') batchId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.bulkImportService.generateErrorReport(batchId, user.tenantId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
