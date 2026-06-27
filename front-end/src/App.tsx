import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PermissionProvider } from "./contexts/PermissionContext";
import { ProtectedRoute, PublicOnlyRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/auth/LoginPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <Routes>
            <Route path="/auth" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/auth/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/auth/register" element={<PublicOnlyRoute><div>Register page (TODO)</div></PublicOnlyRoute>} />
            <Route path="/auth/forgot" element={<PublicOnlyRoute><div>Forgot password (TODO)</div></PublicOnlyRoute>} />

            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute requiredRole="admin"><div>Admin panel (TODO)</div></ProtectedRoute>} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
          </Routes>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
