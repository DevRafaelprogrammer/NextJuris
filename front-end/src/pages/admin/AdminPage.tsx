import { useState } from "react";
import { AdminOverviewTab } from "./AdminOverviewTab";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminAuditTab } from "./AdminAuditTab";

type Tab = "overview" | "users" | "audit";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Visao geral", icon: "📊" },
  { key: "users", label: "Usuarios", icon: "👥" },
  { key: "audit", label: "Auditoria", icon: "📋" },
];

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#C9AA71", fontVariant: "small-caps", display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 16, height: 0.5, background: "#C9AA71", display: "inline-block" }} />
          Administracao
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, margin: 0 }}>Painel do administrador</h1>
        <p style={{ fontSize: 13, color: "#8FA3B1", marginTop: 4 }}>Gestao de usuarios, auditoria e monitoramento do sistema.</p>
      </div>

      <div style={{ display: "flex", borderBottom: "0.5px solid #E2DED6", marginBottom: 20, gap: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "10px 16px", fontSize: 12, fontWeight: 500, border: "none", background: "transparent", cursor: "pointer",
              color: tab === t.key ? "#C9AA71" : "#8FA3B1",
              borderBottom: tab === t.key ? "2px solid #C9AA71" : "2px solid transparent",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <AdminOverviewTab />}
      {tab === "users" && <AdminUsersTab />}
      {tab === "audit" && <AdminAuditTab />}
    </div>
  );
}
