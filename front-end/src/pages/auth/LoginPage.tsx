import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError } from "../../api/client";
import { FormField, PasswordField, Alert, SubmitButton, Divider, SocialButton } from "../../components/ui/FormField";

const ERROR_MAP: Record<string, { msg: string; type: "error" | "warning" }> = {
  INVALID_CREDENTIALS: { msg: "E-mail ou senha incorretos.", type: "error" },
  ACCOUNT_LOCKED: { msg: "Conta bloqueada por excesso de tentativas.", type: "error" },
  ACCOUNT_SUSPENDED: { msg: "Conta suspensa. Entre em contato com o administrador.", type: "warning" },
  ACCOUNT_INACTIVE: { msg: "Conta inativa.", type: "warning" },
  ACCOUNT_PENDING: { msg: "Conta aguardando aprovacao do administrador.", type: "warning" },
  AUTH_RATE_LIMIT: { msg: "Muitas tentativas. Aguarde 15 minutos.", type: "warning" },
  TOKEN_EXPIRED: { msg: "Sua sessao expirou. Faca login novamente.", type: "warning" },
  google_cancelled: { msg: "Login com Google foi cancelado.", type: "warning" },
  google_error: { msg: "Erro ao autenticar com Google. Tente novamente.", type: "error" },
};

function GoogleLoginButton({ returnTo = "/" }: { returnTo?: string }) {
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/google/status", { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => setEnabled(d.data?.enabled || false))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;

  return (
    <a href={enabled ? `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}` : undefined}
      onClick={e => { if (!enabled) { e.preventDefault(); } }}
      style={{
        width: "100%", height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        background: enabled ? "#fff" : "#f5f5f5", border: "0.5px solid #E2DED6", borderRadius: 6,
        fontSize: 13, fontWeight: 500, color: enabled ? "#0F1923" : "#8FA3B1", textDecoration: "none",
        cursor: enabled ? "pointer" : "default", marginBottom: 8,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={e => { if (enabled) { e.currentTarget.style.borderColor = "#C9AA71"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,170,113,0.1)"; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2DED6"; e.currentTarget.style.boxShadow = "none"; }}>
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09a7.18 7.18 0 0 1 0-4.17V7.07H2.18A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77-.01-.54z" fill="#FBBC05"/><path d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 6.07l3.66 2.84c.87-2.6 3.3-4.16 6.16-4.16z" fill="#EA4335"/></svg>
      {enabled ? "Entrar com Google" : "Google (nao configurado)"}
    </a>
  );
}

export function LoginPage() {
  const { login, clearError, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";
  const expired = location.hash === "#expired";
  const hashParams = new URLSearchParams(location.hash.replace("#login?", "").replace("#", ""));
  const googleError = hashParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alert, setAlert] = useState<{ type: "error" | "success" | "warning" | "info"; msg: string } | null>(() => {
    if (expired) return { type: "warning", msg: "Sua sessao expirou. Faca login novamente." };
    if (googleError) {
      const mapped = ERROR_MAP[googleError];
      const googleMsg = hashParams.get("message");
      return { type: mapped?.type || "error", msg: mapped?.msg || googleMsg || "Erro no login com Google." };
    }
    return null;
  });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [attempts, setAttempts] = useState(0);

  useEffect(() => { clearError(); }, [clearError]);

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Formato de e-mail invalido.";
    if (!password) errs.password = "Informe sua senha.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setAlert(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const user = await login({ email: email.trim(), password, rememberMe: true });
      setSuccess(true);
      setAlert({ type: "success", msg: `Bem-vindo, ${user.full_name.split(" ")[0]}. Redirecionando...` });
      setTimeout(() => navigate(from, { replace: true }), 1000);
    } catch (err) {
      setLoading(false);
      setAttempts(a => a + 1);

      if (err instanceof ApiError) {
        const mapped = ERROR_MAP[err.code];
        if (mapped) {
          let msg = mapped.msg;
          if (err.code === "INVALID_CREDENTIALS") {
            const remaining = (err.context?.constraint as string)?.match(/(\d+)/)?.[1];
            if (remaining) msg = `E-mail ou senha incorretos. ${remaining} tentativa${remaining !== "1" ? "s" : ""} restante${remaining !== "1" ? "s" : ""}.`;
            setFieldErrors({ password: "Senha incorreta" });
            setPassword("");
          }
          if (err.code === "ACCOUNT_LOCKED") {
            const secs = err.context?.retryAfter as number;
            if (secs) msg = `Conta bloqueada. Tente novamente em ${Math.ceil(secs / 60)} minutos.`;
          }
          setAlert({ type: mapped.type, msg });
        } else {
          setAlert({ type: "error", msg: err.message });
        }
      } else {
        setAlert({ type: "error", msg: "Sem conexao com o servidor. Verifique sua internet." });
      }
    }
  }

  if (authLoading) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ height: 28, width: 120, background: "#f0ede6", borderRadius: 4, marginBottom: 12 }} />
        <div style={{ height: 16, width: 200, background: "#f0ede6", borderRadius: 4, marginBottom: 32 }} />
        <div style={{ height: 42, background: "#f0ede6", borderRadius: 6, marginBottom: 16 }} />
        <div style={{ height: 42, background: "#f0ede6", borderRadius: 6, marginBottom: 24 }} />
        <div style={{ height: 46, background: "#f0ede6", borderRadius: 6 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div style={{ width: 380, background: "#0F1923", padding: "40px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <img src="/logo-icon.svg" alt="NextJuris" style={{ width: 52, height: 52, marginBottom: 20 }} />
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, color: "#F0E8D8", marginBottom: 4 }}>NextJuris</div>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#C9AA71", fontVariant: "small-caps", marginBottom: 24 }}>Inteligencia artificial aplicada ao direito</div>
          <p style={{ fontSize: 13, color: "#8FA3B1", lineHeight: 1.7 }}>Plataforma de geracao automatica de relatorios juridicos com precisao tecnica e linguagem forense.</p>
        </div>
        <div>
          <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
            <div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#C9AA71" }}>12k</div><div style={{ fontSize: 9, color: "#8FA3B1", fontVariant: "small-caps" }}>Relatorios</div></div>
            <div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#C9AA71" }}>97%</div><div style={{ fontSize: 9, color: "#8FA3B1", fontVariant: "small-caps" }}>Precisao</div></div>
            <div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#C9AA71" }}>850</div><div style={{ fontSize: 9, color: "#8FA3B1", fontVariant: "small-caps" }}>Escritorios</div></div>
          </div>
          <div style={{ fontSize: 11, color: "#2A3A47", borderTop: "0.5px solid #2A3A47", paddingTop: 14, display: "flex", alignItems: "center", gap: 6 }}>🔒 Conexao segura · TLS 1.3 · LGPD</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "#FAFAF8" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#C9AA71", fontVariant: "small-caps", display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 16, height: 0.5, background: "#C9AA71", display: "inline-block" }} />
            Acesso ao sistema
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 500, marginBottom: 4, margin: 0 }}>Entrar na sua conta</h1>
          <p style={{ fontSize: 13, color: "#8FA3B1", marginBottom: 24 }}>Acesse o painel de geracao de relatorios juridicos.</p>

          {alert && <Alert type={alert.type} onClose={() => setAlert(null)}>{alert.msg}</Alert>}

          {success ? (
            <div style={{ textAlign: "center", padding: "40px 0", animation: "njFadeIn 0.3s ease-out" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Autenticado</div>
              <div style={{ fontSize: 13, color: "#8FA3B1" }}>Redirecionando ao painel...</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <FormField
                label="E-mail ou OAB" icon="✉" required
                type="email" autoComplete="email" spellCheck={false}
                placeholder="advogado@escritorio.com.br"
                value={email} onChange={v => { setEmail(v); if (fieldErrors.email) setFieldErrors(f => ({ ...f, email: undefined })); }}
                error={fieldErrors.email}
              />

              <PasswordField
                label="Senha" icon="🔒" required
                autoComplete="current-password"
                placeholder="Sua senha de acesso"
                value={password} onChange={v => { setPassword(v); if (fieldErrors.password) setFieldErrors(f => ({ ...f, password: undefined })); }}
                error={fieldErrors.password}
              />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5A6673", cursor: "pointer" }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: "#C9AA71" }} /> Manter conectado
                </label>
                <Link to="/auth/forgot" style={{ fontSize: 12, color: "#C9AA71", textDecoration: "none" }}>Esqueceu a senha?</Link>
              </div>

              <SubmitButton loading={loading} label="Entrar no sistema" loadingLabel="Autenticando..." icon="→" />

              {attempts >= 3 && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(201,170,113,0.08)", borderRadius: 6, fontSize: 11, color: "#B89A5F", textAlign: "center" }}>
                  Dificuldades para acessar? <Link to="/auth/forgot" style={{ color: "#C9AA71", fontWeight: 500, textDecoration: "none" }}>Redefinir senha</Link> ou entre em contato com o suporte.
                </div>
              )}
            </form>
          )}

          {!success && (
            <>
              <Divider text="ou continue com" />
              <GoogleLoginButton returnTo={from} />
              <SocialButton icon="📜" label="Certificado digital (OAB)" />
              <p style={{ textAlign: "center", fontSize: 12, color: "#8FA3B1", marginTop: 16 }}>
                Ainda nao tem acesso? <Link to="/auth/register" style={{ color: "#C9AA71", textDecoration: "none", fontWeight: 500 }}>Solicitar cadastro</Link>
              </p>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes njFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes njSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
