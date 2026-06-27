import { v4 as uuidv4 } from "uuid";

export class InMemoryStore<T extends { id: string }> {
  private items = new Map<string, T>();

  create(data: Omit<T, "id" | "createdAt" | "updatedAt"> & Partial<Pick<T, "id">>): T {
    const now = new Date();
    const item = {
      ...data,
      id: (data as { id?: string }).id || uuidv4(),
      createdAt: now,
      updatedAt: now,
    } as unknown as T;
    this.items.set(item.id, item);
    return item;
  }

  findById(id: string): T | undefined {
    return this.items.get(id);
  }

  findAll(): T[] {
    return [...this.items.values()];
  }

  update(id: string, data: Partial<T>): T | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, id, updatedAt: new Date() } as T;
    this.items.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  count(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  findWhere(predicate: (item: T) => boolean): T[] {
    return this.findAll().filter(predicate);
  }
}
