import { useState, useRef, type InputHTMLAttributes, type ReactNode } from "react";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  icon?: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  onChange: (value: string) => void;
  value: string;
  rightAction?: ReactNode;
}

const s = {
  wrap: { marginBottom: 16 } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5, color: "var(--nj-text, #0F1923)" } as React.CSSProperties,
  required: { color: "#C0392B", marginLeft: 3, fontSize: 11 } as React.CSSProperties,
  inputWrap: { position: "relative" as const, display: "flex", alignItems: "center" },
  icon: { position: "absolute" as const, left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#8FA3B1", pointerEvents: "none" as const },
  input: {
    width: "100%", height: 42, padding: "0 12px 0 38px", fontFamily: "'Inter', sans-serif", fontSize: 13,
    background: "#FAFAF8", border: "0.5px solid #E2DED6", borderRadius: 6, outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  } as React.CSSProperties,
  helper: { fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4, minHeight: 16 } as React.CSSProperties,
};

export function FormField({ label, icon, error, success, hint, required: req, onChange, value, rightAction, ...rest }: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const borderColor = error ? "#C0392B" : success ? "#1D9E75" : focused ? "#C9AA71" : "#E2DED6";
  const shadow = focused ? (error ? "0 0 0 3px rgba(192,57,43,0.1)" : "0 0 0 3px rgba(201,170,113,0.2)") : "none";

  return (
    <div style={s.wrap}>
      <label style={s.label} onClick={() => inputRef.current?.focus()}>
        <span>{label}{req && <span style={s.required}>*</span>}</span>
      </label>
      <div style={s.inputWrap}>
        {icon && <span style={s.icon}>{icon}</span>}
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ ...s.input, borderColor, boxShadow: shadow, paddingLeft: icon ? 38 : 12, paddingRight: rightAction ? 42 : 12, color: "var(--nj-text, #0F1923)" }}
          {...rest}
        />
        {rightAction && <div style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}>{rightAction}</div>}
      </div>
      {(error || success || (hint && focused)) && (
        <div style={{ ...s.helper, color: error ? "#C0392B" : success ? "#1D9E75" : "#8FA3B1" }}>
          {error && "⚠ "}{success && "✓ "}{error || success || hint}
        </div>
      )}
    </div>
  );
}

export function PasswordField({ label, value, onChange, error, success, ...rest }: Omit<FormFieldProps, "rightAction" | "type">) {
  const [show, setShow] = useState(false);
  return (
    <FormField
      {...rest}
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={onChange}
      error={error}
      success={success}
      rightAction={
        <button type="button" onClick={() => setShow(!show)} tabIndex={-1}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: "#8FA3B1", cursor: "pointer", borderRadius: 4, fontSize: 14, transition: "color 0.15s" }}>
          {show ? "🙈" : "👁"}
        </button>
      }
    />
  );
}

interface StrengthBarProps { password: string }

export function PasswordStrengthBar({ password }: StrengthBarProps) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const colors = ["#C0392B", "#E67E22", "#F1C40F", "#1D9E75"];
  const labels = ["Fraca", "Razoavel", "Boa", "Forte"];

  if (!password) return null;

  return (
    <div style={{ marginTop: -8, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < score ? colors[score - 1] : "#E2DED6", transition: "background 0.2s" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: colors[score - 1] || "#8FA3B1" }}>
        {labels[score - 1] || ""}
      </div>
    </div>
  );
}

interface AlertProps { type: "error" | "success" | "warning" | "info"; children: ReactNode; onClose?: () => void }

export function Alert({ type, children, onClose }: AlertProps) {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    error: { bg: "rgba(192,57,43,0.06)", border: "rgba(192,57,43,0.25)", color: "#C0392B" },
    success: { bg: "rgba(29,158,117,0.06)", border: "rgba(29,158,117,0.25)", color: "#1D9E75" },
    warning: { bg: "rgba(201,170,113,0.08)", border: "rgba(201,170,113,0.3)", color: "#B89A5F" },
    info: { bg: "rgba(143,163,177,0.08)", border: "rgba(143,163,177,0.25)", color: "#5A6673" },
  };
  const c = styles[type];
  const icons: Record<string, string> = { error: "⚠", success: "✓", warning: "⚡", info: "ℹ" };

  return (
    <div style={{ padding: "10px 14px", background: c.bg, border: `0.5px solid ${c.border}`, borderRadius: 6, color: c.color, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, animation: "njFadeIn 0.2s ease-out" }}>
      <span>{icons[type]}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", color: c.color, cursor: "pointer", fontSize: 14, padding: 0 }}>✕</button>}
    </div>
  );
}

export function SubmitButton({ loading, label, loadingLabel, icon }: { loading: boolean; label: string; loadingLabel?: string; icon?: string }) {
  return (
    <button type="submit" disabled={loading}
      style={{
        width: "100%", height: 46, background: loading ? "#B89A5F" : "#C9AA71", color: "#0F1923", border: "none", borderRadius: 6,
        fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", textTransform: "uppercase" as const,
        letterSpacing: "0.04em", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "background 0.15s, transform 0.1s", transform: loading ? "none" : undefined,
      }}
      onMouseDown={e => { if (!loading) (e.currentTarget.style.transform = "scale(0.98)"); }}
      onMouseUp={e => { e.currentTarget.style.transform = ""; }}>
      {loading && <Spinner />}
      <span>{loading ? (loadingLabel || "Aguarde...") : label}</span>
      {!loading && icon && <span>{icon}</span>}
    </button>
  );
}

export function Spinner() {
  return (
    <span style={{
      width: 16, height: 16, border: "2px solid rgba(15,25,35,0.2)", borderTopColor: "#0F1923",
      borderRadius: "50%", animation: "njSpin 0.5s linear infinite", display: "inline-block",
    }} />
  );
}

export function Divider({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
      <div style={{ flex: 1, height: 0.5, background: "#E2DED6" }} />
      <span style={{ fontSize: 11, color: "#8FA3B1", fontVariant: "small-caps", letterSpacing: "0.08em" }}>{text}</span>
      <div style={{ flex: 1, height: 0.5, background: "#E2DED6" }} />
    </div>
  );
}

export function SocialButton({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        width: "100%", height: 40, background: "transparent", border: "0.5px solid #E2DED6", borderRadius: 6,
        fontSize: 12, fontWeight: 500, color: "var(--nj-text, #0F1923)", cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", gap: 8, transition: "border-color 0.15s, background 0.15s",
        marginBottom: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9AA71"; e.currentTarget.style.background = "rgba(201,170,113,0.06)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2DED6"; e.currentTarget.style.background = "transparent"; }}>
      <span>{icon}</span> {label}
    </button>
  );
}
