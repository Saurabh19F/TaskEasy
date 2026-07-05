import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ROLE_PERMISSIONS } from '../../common/constants/permissions';
import { normalizeCompanyRole } from '../../common/utils/role.utils';

export class CreateRoleDto {
  name: string;
  description?: string;
  permissions: string[];
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);
    const existing = await this.prisma.role.findFirst({
      where: { tenantId: actor.tenantId, name: dto.name },
    });
    if (existing) throw new ConflictException(`Role '${dto.name}' already exists`);

    return this.prisma.role.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
        isSystem: false,
      },
    });
  }

  async update(id: string, dto: Partial<CreateRoleDto>, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);
    const role = await this.findOne(id, actor.tenantId);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be modified');

    return this.prisma.role.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, actor: JwtPayload) {
    this.assertCompanyAdmin(actor);
    const role = await this.findOne(id, actor.tenantId);
    if (role.isSystem) throw new ForbiddenException('System roles cannot be deleted');

    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }

  getAllPermissionKeys() {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissions,
    }));
  }

  /**
   * Called on tenant creation to seed system roles.
   */
  async seedSystemRoles(tenantId: string) {
    const systemRoles = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER'];
    for (const roleName of systemRoles) {
      const existing = await this.prisma.role.findFirst({
        where: { tenantId, name: roleName, isSystem: true },
      });
      if (!existing) {
        await this.prisma.role.create({
          data: {
            tenantId,
            name: roleName,
            description: `System role: ${roleName}`,
            permissions: ROLE_PERMISSIONS[roleName] || [],
            isSystem: true,
          },
        });
      }
    }
  }

  private assertCompanyAdmin(actor: JwtPayload) {
    if (normalizeCompanyRole(actor.role) !== 'ADMIN') {
      throw new ForbiddenException('Only Admin can manage roles');
    }
  }
}
