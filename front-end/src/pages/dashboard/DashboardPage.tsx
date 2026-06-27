import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import { Can, AdminOnly, RoleBadge } from "../../components/Can";
import { api } from "../../api/client";

interface DashboardData {
  overview: {
    totalReports: number;
    totalCases: number;
    totalClients: number;
    iaPercentage: number;
    totalValue: number;
  };
}

export function DashboardPage() {
  const { displayName, initials, roleLabel, oab, email } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/dashboard").then(setData).catch(() => {});
  }, []);

  const o = data?.overview;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(201,170,113,0.12)", border: "0.5px solid rgba(201,170,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, color: "#C9AA71" }}>{initials}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Ola, {displayName.split(" ")[0]}</div>
          <div style={{ fontSize: 12, color: "#8FA3B1" }}>{roleLabel} {oab && `· ${oab}`} · {email}</div>
        </div>
        <div style={{ marginLeft: "auto" }}><RoleBadge /></div>
      </div>

      {o && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <Can permission="reports:read">
            <StatCard label="Relatorios" value={String(o.totalReports)} />
          </Can>
          <Can permission="cases:read">
            <StatCard label="Processos" value={String(o.totalCases)} />
          </Can>
          <Can permission="clients:read">
            <StatCard label="Clientes" value={String(o.totalClients)} />
          </Can>
          <Can permission="reports:generate">
            <StatCard label="Precisao IA" value={`${o.iaPercentage}%`} />
          </Can>
        </div>
      )}

      <Can permission="reports:generate">
        <div style={{ padding: 20, background: "#0F1923", borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#C9AA71", fontVariant: "small-caps", marginBottom: 6 }}>Geracao IA</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#F0E8D8", marginBottom: 4 }}>Gerar novo relatorio</div>
          <div style={{ fontSize: 12, color: "#8FA3B1" }}>Pareceres, pecas e analises com inteligencia artificial.</div>
        </div>
      </Can>

      <Can permission="financials:read">
        <div style={{ padding: 16, border: "0.5px solid #E2DED6", borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Resumo financeiro</div>
          <div style={{ fontSize: 13, color: "#5A6673" }}>
            Valor total em processos: R$ {o ? (o.totalValue / 1000).toFixed(0) + "k" : "--"}
          </div>
        </div>
      </Can>

      <AdminOnly>
        <div style={{ padding: 16, border: "0.5px solid rgba(192,57,43,0.25)", borderRadius: 8, background: "rgba(192,57,43,0.04)" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#C0392B", marginBottom: 8 }}>Painel administrativo</div>
          <div style={{ fontSize: 12, color: "#5A6673" }}>Acesso exclusivo: gestao de usuarios, audit log, monitoramento do sistema.</div>
        </div>
      </AdminOnly>

      <Can permission="reports:generate" not>
        <div style={{ padding: 16, border: "0.5px solid #E2DED6", borderRadius: 8, marginTop: 16, textAlign: "center", color: "#8FA3B1", fontSize: 13 }}>
          Funcionalidade de geracao IA indisponivel para seu perfil. Fale com o administrador.
        </div>
      </Can>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 16, border: "0.5px solid #E2DED6", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "#8FA3B1", fontVariant: "small-caps", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, color: "#C9AA71" }}>{value}</div>
    </div>
  );
}
