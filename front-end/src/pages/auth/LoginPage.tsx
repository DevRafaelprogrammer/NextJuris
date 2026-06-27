import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError } from "../../api/client";

export function LoginPage() {
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    clearError();
    setLoading(true);

    try {
      await login({ email, password, rememberMe: true });
      navigate(from, { replace: true });
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          const remaining = (err.context?.constraint as string)?.match(/(\d+)/)?.[1];
          setLocalError(remaining ? `Credenciais invalidas. ${remaining} tentativas restantes.` : "Credenciais invalidas.");
        } else if (err.code === "ACCOUNT_LOCKED") setLocalError(err.message);
        else if (err.code === "ACCOUNT_SUSPENDED") setLocalError("Conta suspensa. Entre em contato com o suporte.");
        else if (err.code === "ACCOUNT_PENDING") setLocalError("Conta pendente de aprovacao.");
        else if (err.isRateLimit) setLocalError("Muitas tentativas. Aguarde 15 minutos.");
        else setLocalError(err.message);
      } else {
        setLocalError("Erro ao conectar. Verifique sua internet.");
      }
    }
  }

  const errMsg = localError || error?.message;

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, marginBottom: 8 }}>Entrar</h1>
      <p style={{ color: "#8FA3B1", fontSize: 14, marginBottom: 24 }}>Acesse o painel NextJuris.</p>

      {errMsg && <div style={{ padding: "10px 14px", background: "rgba(192,57,43,0.08)", border: "0.5px solid rgba(192,57,43,0.25)", borderRadius: 6, color: "#C0392B", fontSize: 13, marginBottom: 16 }}>{errMsg}</div>}

      <form onSubmit={handleSubmit}>
        <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4 }}>E-mail</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="advogado@escritorio.com.br" required
          style={{ width: "100%", height: 42, padding: "0 12px", border: "0.5px solid #E2DED6", borderRadius: 6, fontSize: 13, marginBottom: 16, outline: "none" }} />

        <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4 }}>Senha</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" required
          style={{ width: "100%", height: 42, padding: "0 12px", border: "0.5px solid #E2DED6", borderRadius: 6, fontSize: 13, marginBottom: 24, outline: "none" }} />

        <button type="submit" disabled={loading}
          style={{ width: "100%", height: 44, background: "#C9AA71", color: "#0F1923", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", textTransform: "uppercase", letterSpacing: "0.04em", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Autenticando..." : "Entrar no sistema"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 12, color: "#8FA3B1", marginTop: 20 }}>
        <Link to="/auth/forgot" style={{ color: "#C9AA71", textDecoration: "none" }}>Esqueceu a senha?</Link>
        {" · "}
        <Link to="/auth/register" style={{ color: "#C9AA71", textDecoration: "none" }}>Criar conta</Link>
      </p>
    </div>
  );
}
