import { useEffect, useState } from "react";
import { adminApi, type AuditEntry } from "../../api/admin";

export function AdminAuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.audit(50).then(d => setEntries(d.entries)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#8FA3B1" }}>Carregando...</div>;

  const successCount = entries.filter(e => e.success).length;
  const failCount = entries.filter(e => !e.success).length;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div style={{ padding: "8px 16px", border: "0.5px solid #E2DED6", borderRadius: 6, fontSize: 12 }}>
          Total: <strong>{entries.length}</strong>
        </div>
        <div style={{ padding: "8px 16px", border: "0.5px solid rgba(29,158,117,0.25)", borderRadius: 6, fontSize: 12, color: "#1D9E75" }}>
          Sucesso: <strong>{successCount}</strong>
        </div>
        <div style={{ padding: "8px 16px", border: "0.5px solid rgba(192,57,43,0.25)", borderRadius: 6, fontSize: 12, color: "#C0392B" }}>
          Falhas: <strong>{failCount}</strong>
        </div>
      </div>

      <div style={{ border: "0.5px solid #E2DED6", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid #E2DED6", textAlign: "left" }}>
              <th style={th}>Status</th>
              <th style={th}>Usuario</th>
              <th style={th}>IP</th>
              <th style={th}>Dispositivo</th>
              <th style={th}>Motivo da falha</th>
              <th style={{ ...th, textAlign: "right" }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} style={{ borderBottom: "0.5px solid #f0ede6" }}>
                <td style={td}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", background: e.success ? "#1D9E75" : "#C0392B" }} />
                </td>
                <td style={td}>
                  {e.user ? (
                    <div>
                      <div style={{ fontWeight: 500 }}>{e.user.full_name}</div>
                      <div style={{ fontSize: 11, color: "#8FA3B1" }}>{e.user.email}</div>
                    </div>
                  ) : (
                    <span style={{ color: "#8FA3B1" }}>Desconhecido</span>
                  )}
                </td>
                <td style={{ ...td, fontSize: 11, fontFamily: "monospace", color: "#5A6673" }}>
                  {e.ip_address || "—"}
                </td>
                <td style={{ ...td, fontSize: 11, color: "#8FA3B1", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {parseUA(e.user_agent)}
                </td>
                <td style={{ ...td, fontSize: 11, color: e.failure_reason ? "#C0392B" : "#8FA3B1" }}>
                  {e.failure_reason || "—"}
                </td>
                <td style={{ ...td, textAlign: "right", fontSize: 11, color: "#8FA3B1" }}>
                  {formatDate(e.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseUA(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("curl")) return "curl";
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
  if (browser) return browser[0];
  return ua.slice(0, 30) + "...";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 500, color: "#8FA3B1", fontSize: 11, fontVariant: "small-caps", letterSpacing: "0.06em" };
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };
