import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PermissionProvider } from "./contexts/PermissionContext";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { LoginPage } from "./pages/auth/LoginPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import type { ReactNode } from "react";

function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ background: "#FAFAF8", minHeight: "100vh", overflowY: "auto" }}>{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <AppLayout>
            <Routes>
              <Route path="/auth" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/auth/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/auth/register" element={<PublicOnlyRoute><div style={{ padding: 40 }}>Register (TODO)</div></PublicOnlyRoute>} />
              <Route path="/auth/forgot" element={<PublicOnlyRoute><div style={{ padding: 40 }}>Forgot password (TODO)</div></PublicOnlyRoute>} />

              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute requiredRole="admin"><div style={{ padding: 24 }}>Admin panel (TODO)</div></ProtectedRoute>} />
              <Route path="/relatorios/*" element={<ProtectedRoute requiredPermission="reports:read"><div style={{ padding: 24 }}>Relatorios (TODO)</div></ProtectedRoute>} />
              <Route path="/processos/*" element={<ProtectedRoute requiredPermission="cases:read"><div style={{ padding: 24 }}>Processos (TODO)</div></ProtectedRoute>} />
              <Route path="/clientes/*" element={<ProtectedRoute requiredPermission="clients:read"><div style={{ padding: 24 }}>Clientes (TODO)</div></ProtectedRoute>} />
              <Route path="/financeiro/*" element={<ProtectedRoute requiredPermission="financials:read"><div style={{ padding: 24 }}>Financeiro (TODO)</div></ProtectedRoute>} />
              <Route path="/agenda/*" element={<ProtectedRoute requiredPermission="calendar:read"><div style={{ padding: 24 }}>Agenda (TODO)</div></ProtectedRoute>} />
              <Route path="/documentos/*" element={<ProtectedRoute requiredPermission="documents:read"><div style={{ padding: 24 }}>Documentos (TODO)</div></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute requiredPermission="settings:read"><div style={{ padding: 24 }}>Configuracoes (TODO)</div></ProtectedRoute>} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="*" element={<div style={{ padding: 40, textAlign: "center" }}>404 — Pagina nao encontrada</div>} />
            </Routes>
          </AppLayout>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
