// @ts-ignore — Prisma 7 generates to custom output path
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";
import { logger } from "../utils/logger";

function createBasePrisma(): InstanceType<typeof PrismaClient> {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter } as any);
}

function withSoftDelete(prisma: InstanceType<typeof PrismaClient>) {
  return prisma.$extends({
    name: "softDelete",
    query: {
      $allModels: {
        async findMany({ args, query }: any) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findFirst({ args, query }: any) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
        async findUnique({ args, query }: any) {
          if (args.where) args.where.deletedAt = null;
          return query(args);
        },
        async count({ args, query }: any) {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        },
      },
    },
  });
}

function withQueryTiming(prisma: any) {
  return prisma.$extends({
    name: "queryTiming",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const start = performance.now();
          const result = await query(args);
          const elapsed = Math.round(performance.now() - start);
          if (elapsed > 500) {
            logger.warn(`Slow query: ${model}.${operation} took ${elapsed}ms`);
          }
          return result;
        },
      },
    },
  });
}

function withComputedFields(prisma: any) {
  return prisma.$extends({
    name: "computedFields",
    result: {
      report: {
        isGenerated: {
          needs: { generatedBy: true },
          compute(report: { generatedBy: string }) {
            return report.generatedBy === "ia";
          },
        },
        readTimeMinutes: {
          needs: { wordCount: true },
          compute(report: { wordCount: number }) {
            return Math.ceil(report.wordCount / 200);
          },
        },
        statusLabel: {
          needs: { status: true },
          compute(report: { status: string }) {
            const labels: Record<string, string> = {
              rascunho: "Rascunho", gerando: "Gerando...", revisao: "Em revisao",
              finalizado: "Finalizado", aprovado: "Aprovado", arquivado: "Arquivado",
            };
            return labels[report.status] || report.status;
          },
        },
      },
      client: {
        initials: {
          needs: { name: true },
          compute(client: { name: string }) {
            return client.name.split(" ").filter((w) => w.length > 2).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
          },
        },
        typeLabel: {
          needs: { type: true },
          compute(client: { type: string }) {
            return client.type === "pessoa_fisica" ? "Pessoa fisica" : "Pessoa juridica";
          },
        },
      },
      calendarEvent: {
        isOverdue: {
          needs: { startsAt: true, isCompleted: true },
          compute(event: { startsAt: Date; isCompleted: boolean }) {
            return !event.isCompleted && new Date(event.startsAt) < new Date();
          },
        },
        daysUntil: {
          needs: { startsAt: true },
          compute(event: { startsAt: Date }) {
            return Math.ceil((new Date(event.startsAt).getTime() - Date.now()) / 86400000);
          },
        },
      },
      document: {
        sizeFormatted: {
          needs: { sizeBytes: true },
          compute(doc: { sizeBytes: bigint }) {
            const bytes = Number(doc.sizeBytes);
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
            return `${(bytes / 1048576).toFixed(1)} MB`;
          },
        },
      },
      financial: {
        isOverdue: {
          needs: { dueDate: true, status: true },
          compute(f: { dueDate: Date | null; status: string }) {
            return f.status === "pendente" && f.dueDate != null && new Date(f.dueDate) < new Date();
          },
        },
      },
    },
  });
}

function withAuditLog(prisma: any) {
  return prisma.$extends({
    name: "auditLog",
    query: {
      $allModels: {
        async create({ model, args, query }: any) {
          const result = await query(args);
          logger.info(`AUDIT: ${model}.create`, { id: result.id });
          return result;
        },
        async update({ model, args, query }: any) {
          const result = await query(args);
          logger.info(`AUDIT: ${model}.update`, { where: args.where });
          return result;
        },
        async delete({ model, args, query }: any) {
          const result = await query(args);
          logger.info(`AUDIT: ${model}.delete`, { where: args.where });
          return result;
        },
      },
    },
  });
}

let extendedClient: ReturnType<typeof buildExtendedClient> | null = null;

function buildExtendedClient() {
  const base = createBasePrisma();
  const withSD = withSoftDelete(base);
  const withTiming = withQueryTiming(withSD);
  const withComputed = withComputedFields(withTiming);
  return withAuditLog(withComputed);
}

export function getPrisma() {
  if (!extendedClient) {
    extendedClient = buildExtendedClient();
  }
  return extendedClient;
}

export type ExtendedPrismaClient = ReturnType<typeof buildExtendedClient>;

export async function disconnectPrisma(): Promise<void> {
  if (extendedClient) {
    await (extendedClient as any).$disconnect();
    extendedClient = null;
  }
}
