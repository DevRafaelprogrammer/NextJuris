import { useEffect, useState } from "react";
import { adminApi, type AdminOverview } from "../../api/admin";

export function AdminOverviewTab() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.overview().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "#8FA3B1", padding: 40, textAlign: "center" }}>Carregando...</div>;
  if (!data) return <div style={{ color: "#C0392B", padding: 40, textAlign: "center" }}>Erro ao carregar dados.</div>;

  const u = data.users;
  const r = data.reports;
  const s = data.security;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <Stat label="Usuarios" value={String(u.total)} sub={`${u.active7d} ativos (7d)`} />
        <Stat label="Relatorios" value={String(r.total)} sub={`${r.iaPercentage}% por IA`} />
        <Stat label="Processos" value={String(data.cases.total)} sub={`R$ ${(data.cases.totalValue / 1000).toFixed(0)}k valor`} />
        <Stat label="Seguranca" value={`${s.failRate}%`} sub={`${s.loginFailed} logins falhos`} color={s.failRate > 20 ? "#C0392B" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="👥 Usuarios por role">
          {Object.entries(u.byRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
            <Row key={role} label={roleLabel(role)} value={String(count)} badge={roleBadge(role)} />
          ))}
        </Card>
        <Card title="📊 Usuarios por status">
          {Object.entries(u.byStatus).map(([status, count]) => (
            <Row key={status} label={status} value={String(count)} badge={statusBadge(status)} />
          ))}
          <Row label="Verificados" value={String(u.verified)} />
          <Row label="Novos (30d)" value={String(u.newUsers30d)} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="📄 Relatorios por status">
          {Object.entries(r.byStatus).map(([status, count]) => (
            <Row key={status} label={status} value={String(count)} />
          ))}
        </Card>
        <Card title="🖥 Sistema">
          <Row label="Node.js" value={data.system.nodeVersion} />
          <Row label="Uptime" value={formatUptime(data.system.uptime)} />
          <Row label="Memoria (heap)" value={`${Math.round(data.system.memory.heapUsed / 1024 / 1024)} MB`} />
          <Row label="Memoria (rss)" value={`${Math.round(data.system.memory.rss / 1024 / 1024)} MB`} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ padding: 16, border: "0.5px solid #E2DED6", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "#8FA3B1", fontVariant: "small-caps", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, color: color || "#C9AA71" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#8FA3B1", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "0.5px solid #E2DED6", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "0.5px solid #E2DED6", fontSize: 13, fontWeight: 500 }}>{title}</div>
      <div style={{ padding: "8px 16px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #f0ede6", fontSize: 13 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{badge}{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function roleLabel(r: string) {
  const m: Record<string, string> = { admin: "Administrador", socio: "Socio", advogado: "Advogado", associado: "Associado", estagiario: "Estagiario", secretaria: "Secretaria", paralegal: "Paralegal", cliente: "Cliente" };
  return m[r] || r;
}

function roleBadge(r: string) {
  const c: Record<string, string> = { admin: "#C0392B", socio: "#C9AA71", advogado: "#1D9E75", associado: "#378ADD", estagiario: "#8FA3B1", secretaria: "#7F77DD", paralegal: "#D85A30", cliente: "#888" };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c[r] || "#888", display: "inline-block" }} />;
}

function statusBadge(s: string) {
  const c: Record<string, string> = { ativo: "#1D9E75", pendente: "#C9AA71", suspenso: "#C0392B", inativo: "#888" };
  return <span style={{ width: 8, height: 8, borderRadius: "50%", background: c[s] || "#888", display: "inline-block" }} />;
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
