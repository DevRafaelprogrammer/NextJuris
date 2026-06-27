import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import { Can, CanAny, AdminOnly, SocioOrAbove, AdvogadoOrAbove, RoleSwitch, RoleBadge, PermissionGate, useRoleActions } from "../../components/Can";
import { api } from "../../api/client";

interface Overview {
  totalReports: number;
  totalCases: number;
  totalClients: number;
  iaPercentage: number;
  totalValue: number;
  iaGenerated: number;
  totalDocuments: number;
}

export function DashboardPage() {
  const user = useUser();
  const actions = useRoleActions();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ overview: Overview }>("/dashboard")
      .then(d => setOverview(d.overview))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(201,170,113,0.12)", border: "0.5px solid rgba(201,170,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 500, color: "#C9AA71", fontSize: 16 }}>{user.initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 500, fontFamily: "'Playfair Display', serif" }}>
            <RoleSwitch cases={{
              admin: <>Ola, {user.displayName.split(" ")[0]}. Visao completa do sistema.</>,
              socio: <>Ola, {user.displayName.split(" ")[0]}. Resumo do escritorio.</>,
              advogado: <>Ola, Dr(a). {user.displayName.split(" ")[0]}.</>,
              associado: <>Ola, {user.displayName.split(" ")[0]}.</>,
              estagiario: <>Ola, {user.displayName.split(" ")[0]}. Bom trabalho!</>,
              secretaria: <>Ola, {user.displayName.split(" ")[0]}. Agenda do dia.</>,
              cliente: <>Ola, {user.displayName.split(" ")[0]}. Acompanhe seus processos.</>,
              default: <>Ola, {user.displayName.split(" ")[0]}.</>,
            }} />
          </div>
          <div style={{ fontSize: 12, color: "#8FA3B1", marginTop: 2 }}>
            {user.roleLabel}
            {user.oab && <> · {user.oab}</>}
            {user.office && <> · {user.office}</>}
          </div>
        </div>
        <RoleBadge size="md" showIcon />
      </div>

      {!loading && overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
          <Can permission="reports:read">
            <StatCard label="Relatorios" value={String(overview.totalReports)} sub={`${overview.iaGenerated} por IA`} />
          </Can>
          <Can permission="cases:read">
            <StatCard label="Processos" value={String(overview.totalCases)} />
          </Can>
          <Can permission="clients:read">
            <StatCard label="Clientes" value={String(overview.totalClients)} />
          </Can>
          <AdvogadoOrAbove>
            <StatCard label="Precisao IA" value={`${overview.iaPercentage}%`} />
          </AdvogadoOrAbove>
          <Can permission="financials:read">
            <StatCard label="Valor processos" value={`R$ ${(overview.totalValue / 1000).toFixed(0)}k`} />
          </Can>
          <Can permission="documents:read">
            <StatCard label="Documentos" value={String(overview.totalDocuments)} />
          </Can>
        </div>
      )}

      <PermissionGate requires={["reports:generate"]} denied={
        <Card style={{ textAlign: "center", color: "#8FA3B1" }}>
          <p style={{ fontSize: 13 }}>A geracao de relatorios por IA nao esta disponivel para seu perfil.</p>
          <p style={{ fontSize: 12 }}>Fale com o administrador para solicitar acesso.</p>
        </Card>
      }>
        <Card style={{ background: "#0F1923", border: "none" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#C9AA71", fontVariant: "small-caps", marginBottom: 6 }}>Geracao IA</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#F0E8D8", marginBottom: 4 }}>Gerar novo relatorio</div>
          <div style={{ fontSize: 12, color: "#8FA3B1" }}>Pareceres, pecas e analises com inteligencia artificial especializada em direito brasileiro.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <ActionButton label="Parecer" />
            <ActionButton label="Peca processual" />
            <ActionButton label="Analise" />
          </div>
        </Card>
      </PermissionGate>

      <div style={{ display: "grid", gridTemplateColumns: actions.canViewFinancials ? "1fr 1fr" : "1fr", gap: 16, marginTop: 16 }}>
        <Can permission="cases:read">
          <Card>
            <CardTitle icon="⚖">Processos recentes</CardTitle>
            <div style={{ fontSize: 13, color: "#5A6673" }}>
              <ListItem label="Oliveira vs. Silva Ltda." meta="Instrucao" />
              <ListItem label="Banco Central vs. Oliveira" meta="Recurso" />
              <ListItem label="Souza vs. Construtora Beta" meta="Conciliacao" />
            </div>
            <Can permission="cases:write">
              <div style={{ marginTop: 8 }}>
                <ActionLink label="Adicionar processo" />
              </div>
            </Can>
          </Card>
        </Can>

        <Can permission="financials:read">
          <Card>
            <CardTitle icon="💰">Resumo financeiro</CardTitle>
            <div style={{ fontSize: 13, color: "#5A6673" }}>
              <ListItem label="Faturamento mensal" meta={overview ? `R$ ${(overview.totalValue / 1000 * 0.03).toFixed(0)}k` : "--"} />
              <ListItem label="Honorarios pendentes" meta="R$ 23k" />
            </div>
            <Can permission="financials:approve">
              <div style={{ marginTop: 8 }}>
                <ActionLink label="Aprovar honorarios" />
              </div>
            </Can>
            <Can permission="financials:approve" not>
              <div style={{ marginTop: 8, fontSize: 11, color: "#8FA3B1" }}>Aprovacao requer perfil de socio ou admin.</div>
            </Can>
          </Card>
        </Can>
      </div>

      <SocioOrAbove>
        <Card style={{ marginTop: 16 }}>
          <CardTitle icon="📈">Visao de lideranca</CardTitle>
          <div style={{ fontSize: 13, color: "#5A6673" }}>
            Metricas de desempenho da equipe, taxa de exito processual, e indicadores de produtividade.
          </div>
          <CanAny permissions={["users:read", "audit:read"]}>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Can permission="users:read"><ActionButton label="Equipe" /></Can>
              <Can permission="audit:read"><ActionButton label="Auditoria" /></Can>
            </div>
          </CanAny>
        </Card>
      </SocioOrAbove>

      <AdminOnly>
        <Card style={{ marginTop: 16, borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.03)" }}>
          <CardTitle icon="⚙">Painel administrativo</CardTitle>
          <div style={{ fontSize: 13, color: "#5A6673", marginBottom: 12 }}>
            Gestao completa do sistema — usuarios, roles, sessoes, audit log, monitoramento.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <AdminAction icon="👥" label="Gestao de usuarios" desc="Ativar, suspender, alterar roles" />
            <AdminAction icon="📋" label="Audit log" desc="Historico de logins e acoes" />
            <AdminAction icon="🖥" label="Sistema" desc="Uptime, memoria, banco de dados" />
          </div>
        </Card>
      </AdminOnly>

      <RoleSwitch cases={{
        cliente: (
          <Card style={{ marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Area do cliente</div>
            <div style={{ fontSize: 12, color: "#8FA3B1" }}>Acompanhe seus processos e documentos. Para duvidas, entre em contato com seu advogado.</div>
          </Card>
        ),
        estagiario: (
          <Card style={{ marginTop: 16 }}>
            <CardTitle icon="📚">Recursos para estagiarios</CardTitle>
            <div style={{ fontSize: 12, color: "#8FA3B1" }}>Acesse modelos, jurisprudencia e materiais de estudo. Seus relatorios serao revisados pelo orientador.</div>
          </Card>
        ),
      }} />

    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: 20, border: "0.5px solid #E2DED6", borderRadius: 8, ...style }}>{children}</div>;
}

function CardTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><span>{icon}</span>{children}</div>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ padding: 16, border: "0.5px solid #E2DED6", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "#8FA3B1", fontVariant: "small-caps", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 500, color: "#C9AA71" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#1D9E75", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ListItem({ label, meta }: { label: string; meta: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #E2DED6" }}>
      <span>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: "#C9AA71" }}>{meta}</span>
    </div>
  );
}

function ActionButton({ label }: { label: string }) {
  return <button style={{ padding: "6px 14px", background: "rgba(201,170,113,0.12)", border: "0.5px solid rgba(201,170,113,0.3)", borderRadius: 6, color: "#C9AA71", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{label}</button>;
}

function ActionLink({ label }: { label: string }) {
  return <button style={{ background: "none", border: "none", color: "#C9AA71", fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0 }}>{label} →</button>;
}

function AdminAction({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ padding: 12, border: "0.5px solid #E2DED6", borderRadius: 6, cursor: "pointer" }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ fontSize: 12, fontWeight: 500, marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#8FA3B1" }}>{desc}</div>
    </div>
  );
}
