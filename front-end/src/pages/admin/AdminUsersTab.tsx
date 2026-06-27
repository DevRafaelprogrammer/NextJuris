import { useEffect, useState, useCallback } from "react";
import { adminApi, type AdminUser } from "../../api/admin";
import { RoleBadge } from "../../components/Can";
import { useUser } from "../../hooks/useUser";
import type { Role } from "../../types/auth";

const ROLES: Role[] = ["admin", "socio", "advogado", "associado", "paralegal", "secretaria", "estagiario", "cliente"];

export function AdminUsersTab() {
  const { user: currentUser } = useUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 15 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;
      const result = await adminApi.users(params);
      setUsers(result.data);
      setTotal(result.meta.total);
    } catch { setMessage({ type: "error", text: "Erro ao carregar usuarios." }); }
    setLoading(false);
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function handleAction(userId: string, action: string, extra?: unknown) {
    if (userId === currentUser?.id && ["suspend", "delete"].includes(action)) {
      setMessage({ type: "error", text: "Voce nao pode aplicar esta acao na sua propria conta." });
      return;
    }
    setActionLoading(userId);
    setMessage(null);
    try {
      switch (action) {
        case "activate": await adminApi.activateUser(userId); break;
        case "suspend": await adminApi.suspendUser(userId); break;
        case "unlock": await adminApi.unlockUser(userId); break;
        case "revoke": await adminApi.revokeSessions(userId); break;
        case "delete":
          if (!confirm("Excluir este usuario permanentemente?")) { setActionLoading(null); return; }
          await adminApi.deleteUser(userId);
          break;
        case "role": await adminApi.changeRole(userId, extra as Role); break;
      }
      setMessage({ type: "success", text: `Acao "${action}" executada com sucesso.` });
      loadUsers();
    } catch (err: unknown) {
      setMessage({ type: "error", text: (err as Error).message || "Erro ao executar acao." });
    }
    setActionLoading(null);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome, email, OAB..."
          style={{ flex: 1, minWidth: 200, height: 36, padding: "0 12px", border: "0.5px solid #E2DED6", borderRadius: 6, fontSize: 13, outline: "none" }} />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          style={{ height: 36, padding: "0 12px", border: "0.5px solid #E2DED6", borderRadius: 6, fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="">Todas as roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{ height: 36, padding: "0 12px", border: "0.5px solid #E2DED6", borderRadius: 6, fontSize: 12, outline: "none", cursor: "pointer" }}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="pendente">Pendente</option>
          <option value="suspenso">Suspenso</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {message && (
        <div style={{ padding: "10px 14px", borderRadius: 6, fontSize: 12, marginBottom: 12, border: "0.5px solid",
          background: message.type === "success" ? "rgba(29,158,117,0.06)" : "rgba(192,57,43,0.06)",
          borderColor: message.type === "success" ? "rgba(29,158,117,0.25)" : "rgba(192,57,43,0.25)",
          color: message.type === "success" ? "#1D9E75" : "#C0392B" }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8FA3B1" }}>Carregando...</div>
      ) : (
        <div style={{ border: "0.5px solid #E2DED6", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #E2DED6", textAlign: "left" }}>
                <th style={th}>Usuario</th>
                <th style={th}>Role</th>
                <th style={th}>Status</th>
                <th style={th}>Ultimo login</th>
                <th style={{ ...th, textAlign: "right" }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "0.5px solid #f0ede6" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{u.full_name}</div>
                    <div style={{ fontSize: 11, color: "#8FA3B1" }}>
                      {u.email}
                      {u.oab_number && ` · OAB/${u.oab_state} ${u.oab_number}`}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <RoleBadge role={u.role} size="sm" />
                      {u.id !== currentUser?.id && (
                        <select value={u.role} onChange={e => handleAction(u.id, "role", e.target.value)}
                          disabled={actionLoading === u.id}
                          style={{ border: "none", background: "transparent", fontSize: 11, color: "#8FA3B1", cursor: "pointer", outline: "none" }}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    <StatusBadge status={u.status} locked={u.isLocked} />
                  </td>
                  <td style={{ ...td, color: "#8FA3B1", fontSize: 11 }}>
                    {u.last_login_at ? timeAgo(u.last_login_at) : "Nunca"}
                    <div>{u.login_count} logins</div>
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {u.status === "pendente" && (
                        <ActionBtn label="Ativar" color="#1D9E75" onClick={() => handleAction(u.id, "activate")} loading={actionLoading === u.id} />
                      )}
                      {u.status === "ativo" && u.id !== currentUser?.id && (
                        <ActionBtn label="Suspender" color="#C0392B" onClick={() => handleAction(u.id, "suspend")} loading={actionLoading === u.id} />
                      )}
                      {u.status === "suspenso" && (
                        <ActionBtn label="Reativar" color="#1D9E75" onClick={() => handleAction(u.id, "activate")} loading={actionLoading === u.id} />
                      )}
                      {u.isLocked && (
                        <ActionBtn label="Desbloquear" color="#C9AA71" onClick={() => handleAction(u.id, "unlock")} loading={actionLoading === u.id} />
                      )}
                      <ActionBtn label="Sessoes" color="#8FA3B1" onClick={() => handleAction(u.id, "revoke")} loading={actionLoading === u.id} />
                      {u.id !== currentUser?.id && (
                        <ActionBtn label="Excluir" color="#C0392B" onClick={() => handleAction(u.id, "delete")} loading={actionLoading === u.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "0.5px solid #E2DED6", fontSize: 11, color: "#8FA3B1" }}>
            <span>{total} usuarios</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={pagBtn}>← Anterior</button>
              <span style={{ padding: "4px 8px" }}>Pagina {page}</span>
              <button disabled={users.length < 15} onClick={() => setPage(p => p + 1)} style={pagBtn}>Proximo →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, locked }: { status: string; locked: boolean }) {
  if (locked) return <Badge color="#C0392B" label="Bloqueado" />;
  const m: Record<string, { color: string; label: string }> = {
    ativo: { color: "#1D9E75", label: "Ativo" },
    pendente: { color: "#C9AA71", label: "Pendente" },
    suspenso: { color: "#C0392B", label: "Suspenso" },
    inativo: { color: "#888", label: "Inativo" },
  };
  const cfg = m[status] || { color: "#888", label: status };
  return <Badge color={cfg.color} label={cfg.label} />;
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10, background: `${color}15`, color, border: `0.5px solid ${color}30`, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label}
    </span>
  );
}

function ActionBtn({ label, color, onClick, loading }: { label: string; color: string; onClick: () => void; loading: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding: "3px 8px", fontSize: 10, fontWeight: 500, border: `0.5px solid ${color}30`, borderRadius: 4, background: "transparent", color, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
      {label}
    </button>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 500, color: "#8FA3B1", fontSize: 11, fontVariant: "small-caps", letterSpacing: "0.06em" };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
const pagBtn: React.CSSProperties = { padding: "4px 10px", fontSize: 11, border: "0.5px solid #E2DED6", borderRadius: 4, background: "transparent", cursor: "pointer", color: "#5A6673" };
