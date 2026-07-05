import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CachePatterns } from '../../common/utils/cache-keys.utils';
import { CreateProjectDto, UpdateProjectDto, ProjectQueryDto } from './dto/project.dto';

const PROJECT_CACHE_KEY = (tenantId: string) => `projects:active:${tenantId}`;
const PROJECT_CACHE_TTL = 1800; // 30 min

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(dto: CreateProjectDto, tenantId: string, createdBy: string) {
    // Unique name per tenant
    const existing = await this.prisma.project.findFirst({
      where: { tenantId, name: { equals: dto.name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Project name already exists');

    const project = await this.prisma.project.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        status: 'ACTIVE',
        createdBy,
      },
    });

    await this.redis.del(PROJECT_CACHE_KEY(tenantId));
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    return project;
  }

  async findAll(tenantId: string, query: ProjectQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Returns active projects for dropdowns — cached 30 min.
   */
  async findActive(tenantId: string) {
    const cacheKey = PROJECT_CACHE_KEY(tenantId);
    const cached = await this.redis.get<any[]>(cacheKey);
    if (cached) return cached;

    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });

    await this.redis.set(cacheKey, projects, PROJECT_CACHE_TTL);
    return projects;
  }

  async findOne(id: string, tenantId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, tenantId: string) {
    await this.findOne(id, tenantId);

    if (dto.name) {
      const conflict = await this.prisma.project.findFirst({
        where: {
          tenantId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (conflict) throw new ConflictException('Project name already exists');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: dto,
    });

    await this.redis.del(PROJECT_CACHE_KEY(tenantId));
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    return updated;
  }

  async toggleStatus(id: string, tenantId: string) {
    const project = await this.findOne(id, tenantId);

    // This is meant to be a simple Active/Paused power switch. Archived or
    // completed projects aren't "paused" — they were deliberately retired —
    // so toggling them must not silently resurrect them back to ACTIVE.
    // Only delete()/update() should change those statuses.
    if (['ARCHIVED', 'COMPLETED'].includes(project.status)) {
      throw new BadRequestException(
        `Can't toggle a project that is ${project.status}. Edit it directly to change its status.`,
      );
    }

    const newStatus = project.status === 'ACTIVE' ? 'ON_HOLD' : 'ACTIVE';

    const updated = await this.prisma.project.update({
      where: { id },
      data: { status: newStatus },
    });

    await this.redis.del(PROJECT_CACHE_KEY(tenantId));
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    return updated;
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // Nullify projectId on task records so they are retained as business data
    await this.prisma.delegationTask.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await this.prisma.workRequest.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await this.prisma.checklistTask.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await this.prisma.project.delete({ where: { id } });

    await this.redis.del(PROJECT_CACHE_KEY(tenantId));
    await this.redis.delByPattern(CachePatterns.dashboard(tenantId));
    return { message: 'Project deleted successfully' };
  }

  async exportAll(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { name: true, description: true, color: true },
      orderBy: { name: 'asc' },
    });
    return projects.map((p) => ({
      Name: p.name,
      Description: p.description ?? '',
      Color: p.color ?? '',
    }));
  }

  async importBulk(rows: any[], tenantId: string, createdBy: string) {
    let created = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const name = (row.Name ?? '').toString().trim();
      if (!name) { errors.push('Row skipped: Name is required'); continue; }
      try {
        await this.create({ name, description: row.Description?.toString().trim() || undefined, color: row.Color?.toString().trim() || undefined }, tenantId, createdBy);
        created++;
      } catch (e) {
        errors.push(`"${name}": ${(e as Error).message}`);
      }
    }
    return { created, errors };
  }
}
