import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('single')
  @RequirePermissions('upload.file')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      user.tenantId,
      user.sub,
    );
  }

  @Post('multiple')
  @RequirePermissions('upload.file')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtPayload,
  ) {
    if (!files?.length) throw new BadRequestException('No files provided');
    return this.uploadsService.uploadMultiple(files, user.tenantId, user.sub);
  }

  @Delete(':publicId')
  @RequirePermissions('upload.file')
  async deleteFile(
    @Param('publicId') publicId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.uploadsService.deleteFile(
      decodeURIComponent(publicId),
      user.tenantId,
    );
    return { message: 'File deleted successfully' };
  }
}
