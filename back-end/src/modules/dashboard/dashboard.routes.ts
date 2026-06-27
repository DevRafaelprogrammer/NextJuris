import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { getSupabase } from "../../config/supabase";
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

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const [reportStats, caseStats, clientStats, docStats, upcoming, overdue] = await Promise.all([
    reports.getStats(),
    cases.getStats(),
    clients.getStats(),
    documents.getStats(),
    calendar.getUpcoming(7),
    calendar.getOverdue(),
  ]);

  sendSuccess(res, {
    overview: {
      totalReports: reportStats.total,
      iaGenerated: reportStats.iaGenerated,
      iaPercentage: reportStats.iaPercentage,
      totalCases: caseStats.total,
      totalClients: clientStats.total,
      totalDocuments: docStats.total,
      totalValue: caseStats.totalValue,
    },
    reports: { byStatus: reportStats.byStatus, byType: reportStats.byType, totalWords: reportStats.totalWords },
    cases: { byPhase: caseStats.byPhase, upcomingDeadlines: caseStats.upcomingDeadlines },
    clients: { pessoaFisica: clientStats.pessoaFisica, pessoaJuridica: clientStats.pessoaJuridica },
    documents: { byCategory: docStats.byCategory, totalSizeMB: docStats.totalSizeMB },
    agenda: {
      upcomingEvents: upcoming.length,
      overdueEvents: overdue.length,
      nextEvents: upcoming.slice(0, 5),
      overdueList: overdue.slice(0, 3),
    },
    generatedAt: new Date().toISOString(),
  });
}));

router.get("/stats-rpc", asyncHandler(async (_req: Request, res: Response) => {
  const db = getSupabase();
  const { data, error } = await db.rpc("get_dashboard_stats");
  if (error) throw new Error(error.message);
  sendSuccess(res, data);
}));

router.get("/activity", asyncHandler(async (_req: Request, res: Response) => {
  const [recentReports, upcomingEvents, overdueItems] = await Promise.all([
    reports.list({ page: 1, limit: 5, sort: "createdAt", order: "desc" }),
    calendar.getUpcoming(14),
    calendar.getOverdue(),
  ]);

  sendSuccess(res, {
    recentReports: recentReports.data.map((r) => ({ id: r.id, title: r.title, type: r.type, status: r.status, created_at: r.created_at })),
    upcomingDeadlines: upcomingEvents.slice(0, 5).map((e) => ({ id: e.id, title: e.title, type: e.type, date: e.starts_at, priority: e.priority })),
    overdueItems: overdueItems.map((e) => ({ id: e.id, title: e.title, date: e.starts_at, type: e.type })),
  });
}));

export { router as dashboardRoutes };
