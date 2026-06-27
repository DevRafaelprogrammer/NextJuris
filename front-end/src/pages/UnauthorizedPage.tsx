import { Link } from "react-router-dom";
import { useUser } from "../hooks/useUser";

export function UnauthorizedPage() {
  const { roleLabel } = useUser();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 48, color: "#C9AA71", marginBottom: 16 }}>403</div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, marginBottom: 8 }}>Acesso restrito</h1>
      <p style={{ color: "#8FA3B1", fontSize: 14, maxWidth: 400, marginBottom: 24 }}>
        Seu perfil ({roleLabel}) nao tem permissao para acessar esta pagina.
        Entre em contato com o administrador do sistema.
      </p>
      <Link to="/" style={{ color: "#C9AA71", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>Voltar ao painel</Link>
    </div>
  );
}
