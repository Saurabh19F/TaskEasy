import { IsIn, IsOptional } from 'class-validator';
import { ImportModuleName, ImportMode } from '../interfaces/import.interfaces';

export class ImportQueryDto {
  @IsIn(['delegation', 'workRequest', 'checklist', 'fms'])
  module: ImportModuleName;

  @IsOptional()
  @IsIn(['valid_only', 'stop_on_error'])
  mode?: ImportMode = 'valid_only';
}

export class ImportHistoryQueryDto {
  @IsOptional()
  @IsIn(['delegation', 'workRequest', 'checklist', 'fms'])
  module?: ImportModuleName;

  page?: number;
  limit?: number;
}
