import { NavLink } from "react-router-dom";
import { useUser } from "../hooks/useUser";
import { useFilteredMenu, RoleBadge } from "./Can";
import { useAuth } from "../contexts/AuthContext";
import type { Role } from "../types/auth";

interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  path?: string;
  permission?: string;
  role?: Role | Role[];
  minRole?: Role;
  children?: MenuItem[];
  badge?: string | number;
}

const MENU_ITEMS: MenuItem[] = [
  { key: "section-main", label: "Principal", children: [
    { key: "painel", label: "Painel", icon: "📊", path: "/" },
    { key: "relatorios", label: "Relatorios", icon: "📄", path: "/relatorios", permission: "reports:read", badge: 14 },
    { key: "processos", label: "Processos", icon: "⚖", path: "/processos", permission: "cases:read", badge: 7 },
    { key: "clientes", label: "Clientes", icon: "👥", path: "/clientes", permission: "clients:read" },
  ]},
  { key: "section-ia", label: "Geracao IA", minRole: "associado", children: [
    { key: "novo-relatorio", label: "Novo relatorio", icon: "✨", path: "/relatorios/novo", permission: "reports:generate" },
    { key: "modelos", label: "Modelos", icon: "📋", path: "/modelos", permission: "reports:read" },
    { key: "historico", label: "Historico", icon: "🕐", path: "/historico", permission: "reports:read" },
  ]},
  { key: "section-gestao", label: "Gestao", children: [
    { key: "analises", label: "Analises", icon: "📈", path: "/analises", permission: "dashboard:read" },
    { key: "agenda", label: "Agenda", icon: "📅", path: "/agenda", permission: "calendar:read" },
    { key: "financeiro", label: "Financeiro", icon: "💰", path: "/financeiro", permission: "financials:read" },
    { key: "documentos", label: "Documentos", icon: "📁", path: "/documentos", permission: "documents:read" },
  ]},
  { key: "section-sistema", label: "Sistema", children: [
    { key: "admin", label: "Administracao", icon: "⚙", path: "/admin", role: "admin" },
    { key: "config", label: "Configuracoes", icon: "🔧", path: "/configuracoes", permission: "settings:read" },
  ]},
];

const navLinkStyle = (isActive: boolean) => ({
  display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6,
  fontSize: 13, color: isActive ? "#C9AA71" : "#8FA3B1", textDecoration: "none",
  background: isActive ? "rgba(201,170,113,0.12)" : "transparent",
  borderLeft: isActive ? "2px solid #C9AA71" : "2px solid transparent",
  transition: "all 0.15s",
});

export function Sidebar() {
  const { displayName, initials, oab, roleLabel } = useUser();
  const { logout } = useAuth();
  const filteredMenu = useFilteredMenu(MENU_ITEMS);

  return (
    <aside style={{ width: 260, background: "#0F1923", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, borderRight: "0.5px solid #2A3A47" }}>
      <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: "0.5px solid #2A3A47" }}>
        <div style={{ width: 36, height: 36, border: "1.5px solid #C9AA71", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#C9AA71", fontSize: 16 }}>⚖</div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: "#F0E8D8" }}>NextJuris</div>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#C9AA71", fontVariant: "small-caps" }}>Relatorios juridicos</div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        {filteredMenu.map(section => (
          <div key={section.key} style={{ marginBottom: 20 }}>
            {section.label && (
              <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#8FA3B1", fontVariant: "small-caps", padding: "0 10px", marginBottom: 6 }}>{section.label}</div>
            )}
            {section.children?.map(item => (
              <NavLink key={item.key} to={item.path || "/"} end={item.path === "/"} style={({ isActive }) => navLinkStyle(isActive)}>
                {item.icon && <span style={{ fontSize: 16, width: 18, textAlign: "center" }}>{item.icon}</span>}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{ background: "#C9AA71", color: "#0F1923", fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 10, minWidth: 20, textAlign: "center" }}>{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding: "14px 18px", borderTop: "0.5px solid #2A3A47" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(201,170,113,0.12)", border: "0.5px solid rgba(201,170,113,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "#C9AA71" }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#F0E8D8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ fontSize: 10, color: "#8FA3B1" }}>{oab || roleLabel}</div>
          </div>
          <RoleBadge size="sm" />
        </div>
        <button onClick={logout} style={{ width: "100%", padding: "7px 10px", background: "transparent", border: "0.5px solid #2A3A47", borderRadius: 6, color: "#8FA3B1", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}
