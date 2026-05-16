import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "../components/auth/ProtectedRoute";
import { AppLayout } from "../components/common/AppLayout";
import { useAuth } from "../hooks/useAuth";
import { AdminDashboard } from "../pages/AdminDashboard";
import { CoachingMessagePage } from "../pages/CoachingMessagePage";
import { DataValidationPage } from "../pages/DataValidationPage";
import { ExcelUploadPage } from "../pages/ExcelUploadPage";
import { LoginPage } from "../pages/LoginPage";
import { MissionRecommendPage } from "../pages/MissionRecommendPage";
import { RiderAnalysisPage } from "../pages/RiderAnalysisPage";
import { RiderDashboardPage } from "../pages/RiderDashboardPage";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/rider"} replace />;
}

function protectedPage(allowedRoles: ("admin" | "rider")[], page: ReactNode) {
  return (
    <AppLayout>
      <ProtectedRoute allowedRoles={allowedRoles}>{page}</ProtectedRoute>
    </AppLayout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={protectedPage(["admin"], <AdminDashboard />)} />
      <Route path="/upload" element={protectedPage(["admin"], <ExcelUploadPage />)} />
      <Route path="/validation" element={protectedPage(["admin"], <DataValidationPage />)} />
      <Route path="/analysis" element={protectedPage(["admin"], <RiderAnalysisPage />)} />
      <Route path="/missions" element={protectedPage(["admin"], <MissionRecommendPage />)} />
      <Route path="/coaching" element={protectedPage(["admin"], <CoachingMessagePage />)} />
      <Route path="/rider" element={protectedPage(["admin", "rider"], <RiderDashboardPage />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
