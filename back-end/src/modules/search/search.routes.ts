import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { BadRequestError } from "../../utils/errors";
import { getSupabase } from "../../config/supabase";

const router = Router();

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) throw new BadRequestError("Busca requer pelo menos 2 caracteres.");

  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const db = getSupabase();
  const { data, error } = await db.rpc("global_search", { search_query: q, result_limit: limit });
  if (error) throw new Error(error.message);

  const results = (data || []).map((r: any) => ({
    type: r.entity_type,
    id: r.entity_id,
    title: r.title,
    subtitle: r.subtitle,
    relevance: r.relevance,
    icon: ({ client: "users", case: "gavel", report: "file-text", document: "folder", event: "calendar" } as Record<string, string>)[r.entity_type] || "search",
    url: `/api/${r.entity_type === "client" ? "clients" : r.entity_type === "case" ? "cases" : r.entity_type === "report" ? "reports" : r.entity_type === "document" ? "documents" : "calendar"}/${r.entity_id}`,
  }));

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.type] = (counts[r.type] || 0) + 1;

  sendSuccess(res, { query: q, total: results.length, results, counts });
}));

export { router as searchRoutes };
