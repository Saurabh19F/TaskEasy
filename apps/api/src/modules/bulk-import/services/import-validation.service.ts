import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ImportModuleConfig, ParsedRow } from '../interfaces/import.interfaces';

@Injectable()
export class ImportValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(
    rows: ParsedRow[],
    config: ImportModuleConfig,
    tenantId: string,
  ): Promise<ParsedRow[]> {
    const emailCache: Record<string, string | null> = {};

    const resolveEmail = async (email: string): Promise<string | null> => {
      const key = email.toLowerCase().trim();
      if (key in emailCache) return emailCache[key];
      const user = await this.prisma.user.findFirst({
        where: { tenantId, email: { equals: key, mode: 'insensitive' }, status: 'ACTIVE' },
        select: { id: true },
      });
      emailCache[key] = user?.id ?? null;
      return emailCache[key];
    };

    const projectCache: Record<string, string | null> = {};
    const resolveProject = async (name: string): Promise<string | null> => {
      const key = name.toLowerCase().trim();
      if (key in projectCache) return projectCache[key];
      const proj = await this.prisma.project.findFirst({
        where: { tenantId, name: { equals: name.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      projectCache[key] = proj?.id ?? null;
      return projectCache[key];
    };

    for (const row of rows) {
      row.errors = [];
      row.normalizedData = { ...row.rawData };

      for (const col of config.columns) {
        const val = row.rawData[col.key];
        const isEmpty = val === undefined || val === null || String(val).trim() === '';

        if (col.required && isEmpty) {
          row.errors.push(`"${col.header}" is required`);
          continue;
        }
        if (isEmpty) continue;

        const str = String(val).trim();

        if (col.type === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
            row.errors.push(`"${col.header}": invalid email format`);
          } else {
            const userId = await resolveEmail(str);
            if (!userId) {
              row.errors.push(`"${col.header}": user "${str}" not found in this company`);
            } else {
              row.normalizedData![col.key + 'Id'] = userId;
            }
          }
        } else if (col.type === 'enum' && col.enumValues) {
          if (!col.enumValues.includes(str.toUpperCase())) {
            row.errors.push(`"${col.header}": must be one of ${col.enumValues.join(', ')}`);
          } else {
            row.normalizedData![col.key] = str.toUpperCase();
          }
        } else if (col.type === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            row.errors.push(`"${col.header}": date must be YYYY-MM-DD format`);
          } else {
            const d = new Date(str);
            if (isNaN(d.getTime())) {
              row.errors.push(`"${col.header}": invalid date value`);
            }
          }
        } else if (col.type === 'number') {
          if (isNaN(Number(str))) {
            row.errors.push(`"${col.header}": must be a number`);
          } else {
            row.normalizedData![col.key] = Number(str);
          }
        }
      }

      // Module-specific cross-field checks
      if (config.moduleName === 'delegation') {
        const projectName = String(row.rawData['projectName'] || '').trim();
        if (projectName) {
          const projectId = await resolveProject(projectName);
          if (!projectId) {
            row.errors.push(`Project "${projectName}" not found`);
          } else {
            row.normalizedData!['projectId'] = projectId;
          }
        }
      }

      row.isValid = row.errors.length === 0;
    }

    return rows;
  }
}
