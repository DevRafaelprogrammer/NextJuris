import { InMemoryStore } from "../../utils/store";
import { paginate, sortBy, filterBySearch, PaginatedResult } from "../../utils/pagination";
import { NotFoundError } from "../../utils/errors";
import { CreateDocumentInput, UpdateDocumentInput } from "./documents.schema";

export interface Document {
  id: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  caseId: string | null;
  clientId: string | null;
  reportId: string | null;
  tags: string[];
  description: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

const store = new InMemoryStore<Document>();

[
  { name: "Contrato de prestacao de servicos.pdf", category: "contrato", mimeType: "application/pdf", size: 245000, tags: ["contrato", "servicos"] },
  { name: "Peticao inicial — Proc. 0001234.pdf", category: "peca", mimeType: "application/pdf", size: 189000, tags: ["peticao", "civel"] },
  { name: "Parecer tributario — Banco Beta.pdf", category: "parecer", mimeType: "application/pdf", size: 312000, tags: ["tributario", "parecer"] },
  { name: "Procuracao ad judicia.pdf", category: "procuracao", mimeType: "application/pdf", size: 52000, tags: ["procuracao"] },
  { name: "Modelo — Contestacao trabalhista.docx", category: "modelo", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 78000, tags: ["modelo", "trabalhista"] },
  { name: "Laudo pericial contabil.pdf", category: "laudo", mimeType: "application/pdf", size: 890000, tags: ["pericia", "contabil"] },
].forEach((d) => store.create({ ...d, caseId: null, clientId: null, reportId: null, description: "", url: `/documents/${d.name}` } as Omit<Document, "id" | "createdAt" | "updatedAt">));

export class DocumentsService {
  list(query: any): PaginatedResult<Document> {
    let items = store.findAll();
    if (query.search) items = filterBySearch(items, query.search, ["name", "description"]);
    if (query.category) items = items.filter((d) => d.category === query.category);
    if (query.caseId) items = items.filter((d) => d.caseId === query.caseId);
    if (query.clientId) items = items.filter((d) => d.clientId === query.clientId);
    items = sortBy(items, query.sort as keyof Document, query.order);
    return paginate(items, query);
  }

  getById(id: string): Document {
    const doc = store.findById(id);
    if (!doc) throw new NotFoundError("Documento");
    return doc;
  }

  create(input: CreateDocumentInput): Document {
    return store.create({ ...input, caseId: input.caseId ?? null, clientId: input.clientId ?? null, reportId: input.reportId ?? null, description: input.description ?? "", url: `/documents/${input.name}` } as Omit<Document, "id" | "createdAt" | "updatedAt">);
  }

  update(id: string, input: UpdateDocumentInput): Document {
    if (!store.findById(id)) throw new NotFoundError("Documento");
    return store.update(id, input as Partial<Document>)!;
  }

  delete(id: string): void {
    if (!store.findById(id)) throw new NotFoundError("Documento");
    store.delete(id);
  }

  getStats() {
    const all = store.findAll();
    const byCategory: Record<string, number> = {};
    let totalSize = 0;
    for (const d of all) {
      byCategory[d.category] = (byCategory[d.category] || 0) + 1;
      totalSize += d.size;
    }
    return { total: all.length, byCategory, totalSize, totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100 };
  }
}
