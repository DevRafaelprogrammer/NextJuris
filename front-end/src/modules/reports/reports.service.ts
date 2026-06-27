import { InMemoryStore } from "../../utils/store";
import { paginate, sortBy, filterBySearch, PaginatedResult } from "../../utils/pagination";
import { NotFoundError, BadRequestError } from "../../utils/errors";
import { CreateReportInput, UpdateReportInput, ListReportsQuery, GenerateReportInput } from "./reports.schema";

export interface Report {
  id: string;
  title: string;
  type: string;
  status: string;
  clientId: string | null;
  caseId: string | null;
  area: string;
  description: string;
  content: string;
  tags: string[];
  priority: string;
  wordCount: number;
  generatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const store = new InMemoryStore<Report>();

function seed() {
  const reports: Partial<Report>[] = [
    { title: "Parecer sobre danos morais — Silva Ltda.", type: "parecer", status: "finalizado", area: "Direito civil", description: "Analise de viabilidade de acao por danos morais", content: "Parecer juridico...", tags: ["dano moral", "civel"], priority: "alta", wordCount: 3200, generatedBy: "ia" },
    { title: "Contestacao trabalhista — Oliveira vs. Corp", type: "peca", status: "revisao", area: "Direito trabalhista", description: "Peca de defesa em reclamacao trabalhista", content: "Contestacao...", tags: ["trabalhista", "defesa"], priority: "urgente", wordCount: 4800, generatedBy: "ia" },
    { title: "Relatorio de diligencias — Proc. 0004567", type: "relatorio", status: "aprovado", area: "Direito civil", description: "Relatorio de diligencias realizadas", content: "Relatorio...", tags: ["diligencia"], priority: "media", wordCount: 1500, generatedBy: "ia" },
    { title: "Analise contratual — Banco Beta S.A.", type: "analise", status: "finalizado", area: "Direito empresarial", description: "Analise de clausulas contratuais", content: "Analise...", tags: ["contrato", "empresarial"], priority: "media", wordCount: 2800, generatedBy: "ia" },
    { title: "Recurso ordinario — Proc. 0007891", type: "peca", status: "rascunho", area: "Direito civil", description: "Recurso contra decisao de primeira instancia", content: "", tags: ["recurso", "civel"], priority: "urgente", wordCount: 0, generatedBy: "manual" },
  ];
  reports.forEach((r) => store.create(r as Omit<Report, "id" | "createdAt" | "updatedAt">));
}
seed();

export class ReportsService {
  list(query: ListReportsQuery): PaginatedResult<Report> {
    let items = store.findAll();
    if (query.search) items = filterBySearch(items, query.search, ["title", "description", "area"]);
    if (query.type) items = items.filter((r) => r.type === query.type);
    if (query.status) items = items.filter((r) => r.status === query.status);
    if (query.clientId) items = items.filter((r) => r.clientId === query.clientId);
    if (query.caseId) items = items.filter((r) => r.caseId === query.caseId);
    if (query.priority) items = items.filter((r) => r.priority === query.priority);
    items = sortBy(items, query.sort as keyof Report, query.order);
    return paginate(items, query);
  }

  getById(id: string): Report {
    const report = store.findById(id);
    if (!report) throw new NotFoundError("Relatorio");
    return report;
  }

  create(input: CreateReportInput): Report {
    return store.create({
      ...input,
      clientId: input.clientId ?? null,
      caseId: input.caseId ?? null,
      area: input.area ?? "",
      description: input.description ?? "",
      status: "rascunho",
      content: "",
      wordCount: 0,
      generatedBy: "manual",
    } as Omit<Report, "id" | "createdAt" | "updatedAt">);
  }

  update(id: string, input: UpdateReportInput): Report {
    const existing = store.findById(id);
    if (!existing) throw new NotFoundError("Relatorio");
    const updated = store.update(id, {
      ...input,
      wordCount: input.content ? input.content.split(/\s+/).length : existing.wordCount,
    } as Partial<Report>);
    return updated!;
  }

  delete(id: string): void {
    const existing = store.findById(id);
    if (!existing) throw new NotFoundError("Relatorio");
    store.delete(id);
  }

  generate(input: GenerateReportInput): Report {
    const content = `PARECER JURÍDICO\n\nI. DOS FATOS\n\n${input.context}\n\nII. DO DIREITO\n\nConforme a legislacao vigente e a jurisprudencia dos tribunais superiores, verifica-se que a questao apresentada encontra respaldo no ordenamento juridico brasileiro.\n\nIII. DA CONCLUSAO\n\nDiante do exposto, opina-se pela viabilidade da medida pleiteada, nos termos da fundamentacao acima expendida.\n\n${input.area} · Gerado por IA NextJuris`;
    return store.create({
      title: `${input.type.charAt(0).toUpperCase() + input.type.slice(1)} — ${input.area}`,
      type: input.type,
      status: "revisao",
      clientId: input.clientId ?? null,
      caseId: input.caseId ?? null,
      area: input.area,
      description: `Gerado automaticamente a partir de contexto fornecido. Tom: ${input.tone}.`,
      content,
      tags: [input.area.toLowerCase(), "ia", input.type],
      priority: "media",
      wordCount: content.split(/\s+/).length,
      generatedBy: "ia",
    } as Omit<Report, "id" | "createdAt" | "updatedAt">);
  }

  getStats() {
    const all = store.findAll();
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalWords = 0;
    let iaGenerated = 0;
    for (const r of all) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.type] = (byType[r.type] || 0) + 1;
      totalWords += r.wordCount;
      if (r.generatedBy === "ia") iaGenerated++;
    }
    return { total: all.length, byStatus, byType, totalWords, iaGenerated, iaPercentage: all.length ? Math.round((iaGenerated / all.length) * 100) : 0 };
  }

  duplicate(id: string): Report {
    const original = this.getById(id);
    return store.create({
      title: `${original.title} (copia)`,
      type: original.type,
      status: "rascunho",
      clientId: original.clientId,
      caseId: original.caseId,
      area: original.area,
      description: original.description,
      content: original.content,
      tags: [...original.tags],
      priority: original.priority,
      wordCount: original.wordCount,
      generatedBy: "manual",
    } as Omit<Report, "id" | "createdAt" | "updatedAt">);
  }
}
