import { getPrisma } from "../config/prisma";
import { NotFoundError } from "./errors";

export interface PaginationOpts {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class PrismaRepository<T extends { id: string }> {
  constructor(
    private modelName: string,
    private entityLabel: string = "Registro"
  ) {}

  private get model(): any {
    return (getPrisma() as any)[this.modelName];
  }

  async findAll(opts: PaginationOpts & { where?: any; include?: any; orderBy?: any } = {}): Promise<PaginatedResult<T>> {
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const skip = (page - 1) * limit;

    const orderBy = opts.orderBy || { [opts.sort || "createdAt"]: opts.order || "desc" };

    const [data, total] = await Promise.all([
      this.model.findMany({ where: opts.where, include: opts.include, orderBy, skip, take: limit }),
      this.model.count({ where: opts.where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  async findById(id: string, include?: any): Promise<T> {
    const item = await this.model.findUnique({ where: { id }, include });
    if (!item) throw new NotFoundError(this.entityLabel);
    return item;
  }

  async create(data: any, include?: any): Promise<T> {
    return this.model.create({ data, include });
  }

  async update(id: string, data: any, include?: any): Promise<T> {
    const exists = await this.model.findUnique({ where: { id } });
    if (!exists) throw new NotFoundError(this.entityLabel);
    return this.model.update({ where: { id }, data, include });
  }

  async delete(id: string): Promise<T> {
    const exists = await this.model.findUnique({ where: { id } });
    if (!exists) throw new NotFoundError(this.entityLabel);
    return this.model.delete({ where: { id } });
  }

  async count(where?: any): Promise<number> {
    return this.model.count({ where });
  }

  async aggregate(opts: { _sum?: any; _avg?: any; _count?: any; _min?: any; _max?: any; where?: any }) {
    return this.model.aggregate(opts);
  }

  async groupBy(opts: { by: string[]; _count?: any; _sum?: any; where?: any; orderBy?: any }) {
    return this.model.groupBy(opts);
  }

  async findFirst(where: any, include?: any): Promise<T | null> {
    return this.model.findFirst({ where, include });
  }

  async exists(where: any): Promise<boolean> {
    const count = await this.model.count({ where });
    return count > 0;
  }

  async upsert(where: any, create: any, update: any): Promise<T> {
    return this.model.upsert({ where, create, update });
  }

  async transaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
    return (getPrisma() as any).$transaction(fn);
  }
}
