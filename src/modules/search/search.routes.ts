import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { BadRequestError } from "../../utils/errors";
import { ReportsService } from "../reports/reports.service";
import { CasesService } from "../cases/cases.service";
import { ClientsService } from "../clients/clients.service";
import { DocumentsService } from "../documents/documents.service";
import { CalendarService } from "../calendar/calendar.service";

const router = Router();
const reports = new ReportsService();
const cases = new CasesService();
const clients = new ClientsService();
const documents = new DocumentsService();
const calendar = new CalendarService();

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) throw new BadRequestError("Busca requer pelo menos 2 caracteres.");

  const limit = Math.min(Number(req.query.limit) || 5, 20);

  const reportResults = reports.list({ page: 1, limit, sort: "createdAt", order: "desc", search: q });
  const caseResults = cases.list({ page: 1, limit, sort: "updatedAt", order: "desc", search: q });
  const clientResults = clients.list({ page: 1, limit, sort: "name", order: "asc", search: q });
  const docResults = documents.list({ page: 1, limit, sort: "createdAt", order: "desc", search: q });
  const eventResults = calendar.list({ page: 1, limit, search: q });

  const results = [
    ...reportResults.data.map((r) => ({ type: "relatorio" as const, id: r.id, title: r.title, subtitle: `${r.type} · ${r.status}`, icon: "file-text", url: `/api/reports/${r.id}` })),
    ...caseResults.data.map((c) => ({ type: "processo" as const, id: c.id, title: c.parties, subtitle: `${c.number} · ${c.phase}`, icon: "gavel", url: `/api/cases/${c.id}` })),
    ...clientResults.data.map((c) => ({ type: "cliente" as const, id: c.id, title: c.name, subtitle: `${c.type === "pessoa_fisica" ? "PF" : "PJ"} · ${c.document}`, icon: "users", url: `/api/clients/${c.id}` })),
    ...docResults.data.map((d) => ({ type: "documento" as const, id: d.id, title: d.name, subtitle: `${d.category} · ${Math.round(d.size / 1024)}KB`, icon: "folder", url: `/api/documents/${d.id}` })),
    ...eventResults.data.map((e) => ({ type: "evento" as const, id: e.id, title: e.title, subtitle: `${e.type} · ${new Date(e.date).toLocaleDateString("pt-BR")}`, icon: "calendar", url: `/api/calendar/${e.id}` })),
  ];

  sendSuccess(res, {
    query: q,
    total: results.length,
    results,
    counts: {
      relatorios: reportResults.meta.total,
      processos: caseResults.meta.total,
      clientes: clientResults.meta.total,
      documentos: docResults.meta.total,
      eventos: eventResults.meta.total,
    },
  });
}));

export { router as searchRoutes };
