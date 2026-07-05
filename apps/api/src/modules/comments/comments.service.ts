import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  /** The task/request ID this comment belongs to */
  @IsString()
  refId: string;

  /** DELEGATION | WORK_REQUEST | CHECKLIST | FMS_STEP */
  @IsString()
  refType: string;

  @IsString()
  @MinLength(1)
  parentId?: string;
}

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCommentDto, tenantId: string, authorId: string) {
    return this.prisma.comment.create({
      data: {
        tenantId,
        refId: dto.refId,
        refType: dto.refType,
        authorId,
        body: dto.body,
        parentId: dto.parentId,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  async findByRef(refId: string, tenantId: string) {
    return this.prisma.comment.findMany({
      where: { refId, tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true } },
        replies: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async delete(id: string, tenantId: string, userId: string, role: string) {
    const comment = await this.prisma.comment.findFirst({ where: { id, tenantId } });
    if (!comment) throw new NotFoundException('Comment not found');

    // Only author or admin can delete
    if (comment.authorId !== userId && !['ADMIN'].includes(role)) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    return this.prisma.comment.delete({ where: { id } });
  }
}
