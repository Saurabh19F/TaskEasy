import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { PrismaService } from '../../prisma/prisma.service';

export interface UploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  originalName: string;
  mimeType: string;
  size: number;
  format: string;
  resourceType: string;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    cloudinary.config({
      cloud_name: configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get('CLOUDINARY_API_KEY'),
      api_secret: configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  /**
   * Upload a single file buffer to Cloudinary.
   * Stores metadata in Attachment table.
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    tenantId: string,
    uploadedById: string,
    folder = 'taskeasy',
  ): Promise<UploadResult> {
    this.validateFile(buffer, mimeType);

    const result = await this.uploadToCloudinary(buffer, {
      folder: `${folder}/${tenantId}`,
      resource_type: this.getResourceType(mimeType),
      use_filename: true,
      unique_filename: true,
    });

    // Store in Attachments table
    await this.prisma.attachment.create({
      data: {
        tenantId,
        publicId: result.public_id,
        url: result.secure_url,
        originalName,
        mimeType,
        size: result.bytes,
        format: result.format,
        resourceType: result.resource_type,
        uploadedById,
      },
    });

    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      originalName,
      mimeType,
      size: result.bytes,
      format: result.format,
      resourceType: result.resource_type,
    };
  }

  /**
   * Upload multiple files. Returns array of results.
   */
  async uploadMultiple(
    files: { buffer: Buffer; originalname: string; mimetype: string }[],
    tenantId: string,
    uploadedById: string,
    folder = 'taskeasy',
  ): Promise<UploadResult[]> {
    if (files.length > 10) {
      throw new BadRequestException('Maximum 10 files allowed per upload');
    }
    return Promise.all(
      files.map((f) => this.uploadFile(f.buffer, f.originalname, f.mimetype, tenantId, uploadedById, folder)),
    );
  }

  /**
   * Delete a file from Cloudinary by publicId.
   * Also removes Attachment record.
   */
  async deleteFile(publicId: string, tenantId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { publicId, tenantId },
    });
    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: attachment.resourceType as any,
    });

    await this.prisma.attachment.delete({ where: { id: attachment.id } });
    this.logger.log(`Deleted file: ${publicId}`);
  }

  /**
   * Get a signed URL for a private resource (optional).
   */
  getSignedUrl(publicId: string, expiresIn = 3600): string {
    return cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private isValidMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    const magic = buffer.slice(0, 8);
    const isPDF = magic.slice(0, 4).toString('ascii') === '%PDF';
    const isPNG = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47;
    const isJPEG = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
    const isGIF = magic.slice(0, 3).toString('ascii') === 'GIF';
    const isWEBP = buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP';
    const isMP4 = buffer.length >= 8 && (buffer.slice(4, 8).toString('ascii') === 'ftyp' || buffer.slice(4, 8).toString('ascii') === 'moov');
    return isPDF || isPNG || isJPEG || isGIF || isWEBP || isMP4;
  }

  private validateFile(buffer: Buffer, mimeType: string): void {
    const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'video/mp4', 'video/quicktime',
    ];
    // Types with reliably identifiable magic bytes
    const MAGIC_CHECKED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'video/mp4', 'video/quicktime',
    ];

    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException('File size exceeds 50 MB limit');
    }
    if (!ALLOWED_TYPES.includes(mimeType)) {
      throw new BadRequestException(`File type ${mimeType} is not allowed`);
    }
    if (MAGIC_CHECKED_TYPES.includes(mimeType) && !this.isValidMagicBytes(buffer)) {
      throw new BadRequestException('File content does not match the declared file type');
    }
  }

  private getResourceType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'raw';
  }

  private uploadToCloudinary(
    buffer: Buffer,
    options: Record<string, any>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(options, (error, result) => {
          if (error) return reject(new InternalServerErrorException(error.message));
          resolve(result!);
        })
        .end(buffer);
    });
  }
}
