import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generates human-readable IDs like TASK-2026-0001.
 * These are stored alongside MongoDB ObjectIds for user-facing display.
 */

function padded(n: number, digits = 4): string {
  return String(n).padStart(digits, '0');
}

function year(): string {
  return String(new Date().getFullYear());
}

// ── Formatter functions (pure, no DB) ────────────────────────────────────────

export function generateTaskId(sequence: number): string {
  return `TASK-${year()}-${padded(sequence)}`;
}

export function generateDelegationId(sequence: number): string {
  return `TASK-${year()}-${padded(sequence)}`;
}

export function generateWorkRequestId(sequence: number): string {
  return `WR-${year()}-${padded(sequence)}`;
}

export function generateChecklistMasterId(sequence: number): string {
  return `CLM-${year()}-${padded(sequence)}`;
}

export function generateChecklistTaskId(sequence: number): string {
  return `CL-${year()}-${padded(sequence)}`;
}

export function generateFmsWorkflowId(sequence: number): string {
  return `WF-${year()}-${padded(sequence, 3)}`;
}

export function generateFmsTaskId(sequence: number): string {
  return `FMS-${year()}-${padded(sequence)}`;
}

// ── Atomic sequence (BUG-01 fix) ─────────────────────────────────────────────
//
// Previous pattern was `count() + 1` — not atomic under concurrent requests.
// Two simultaneous calls both read count=100 and both write TASK-2026-0101.
//
// `atomicNextSequence` uses a MongoDB findOneAndUpdate (Prisma's upsert +
// atomic increment on a dedicated Sequence document). Only one caller can
// hold the incremented value at a time, so IDs are guaranteed unique.
//
// The `key` is scoped per-tenant AND per-prefix so counters don't bleed
// between tenants or entity types (e.g. tenantA's TASK counter is
// independent from tenantB's TASK counter).

export async function atomicNextSequence(
  prisma: PrismaService,
  tenantId: string,
  prefix: string,
): Promise<number> {
  const key = `${tenantId}:${prefix}:${year()}`;

  // Prisma's MongoDB adapter exposes findOneAndUpdate via runCommandRaw,
  // which is the only truly atomic increment path. The upsert below is
  // equivalent to: db.sequences.findOneAndUpdate(
  //   { key }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' }
  // )
  const result = await (prisma as any).$runCommandRaw({
    findAndModify: 'Sequence',
    query: { key },
    update: { $inc: { value: 1 } },
    upsert: true,
    new: true,
  });

  // result.value is the document after increment
  return (result?.value?.value as number) ?? 1;
}

/**
 * Convenience wrappers — call these in services instead of the old
 * count()-based pattern.
 *
 * Usage (example in delegation.service.ts):
 *   const seq  = await atomicNextDelegationId(prisma, tenantId);
 *   const taskId = generateDelegationId(seq);
 */
export async function atomicNextDelegationId(prisma: PrismaService, tenantId: string): Promise<number> {
  return atomicNextSequence(prisma, tenantId, 'TASK');
}

export async function atomicNextWorkRequestId(prisma: PrismaService, tenantId: string): Promise<number> {
  return atomicNextSequence(prisma, tenantId, 'WR');
}

export async function atomicNextChecklistMasterId(prisma: PrismaService, tenantId: string): Promise<number> {
  return atomicNextSequence(prisma, tenantId, 'CLM');
}

export async function atomicNextChecklistTaskId(prisma: PrismaService, tenantId: string): Promise<number> {
  return atomicNextSequence(prisma, tenantId, 'CL');
}

export async function atomicNextFmsWorkflowId(prisma: PrismaService, tenantId: string): Promise<number> {
  return atomicNextSequence(prisma, tenantId, 'WF');
}

export async function atomicNextFmsTaskId(prisma: PrismaService, tenantId: string): Promise<number> {
  return atomicNextSequence(prisma, tenantId, 'FMS');
}
