import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import NewProject from "@/pages/NewProject";
import ProjectDetail from "@/pages/ProjectDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProjectDetail from "@/pages/AdminProjectDetail";
import AdminUsers from "@/pages/AdminUsers";

function Protected({ children }: { children: React.ReactNode }) {
  return useAuthStore((s) => s.isAuthenticated) ? <>{children}</> : <Navigate to="/auth/login" replace />;
}
function Guest({ children }: { children: React.ReactNode }) {
  return useAuthStore((s) => s.isAuthenticated) ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}
// In production the marketing site lives on inkmagnet.com — the app root only
// routes: logged-in users to the dashboard, everyone else to the Astro site.
function RootGate() {
  const authed = useAuthStore((s) => s.isAuthenticated);
  if (authed) return <Navigate to="/dashboard" replace />;
  if (import.meta.env.PROD) {
    window.location.replace("https://inkmagnet.com");
    return null;
  }
  return <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootGate />} />
      <Route path="/auth/login" element={<Guest><Login /></Guest>} />
      <Route path="/auth/register" element={<Guest><Register /></Guest>} />
      <Route path="/auth/forgot-password" element={<Guest><ForgotPassword /></Guest>} />
      {/* path matches the link emailed by the backend: /reset-password?token=..&email=.. */}
      <Route path="/reset-password" element={<Guest><ResetPassword /></Guest>} />
      <Route path="/dashboard" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
      <Route path="/projects/new" element={<Protected><Layout><NewProject /></Layout></Protected>} />
      <Route path="/projects/:id" element={<Protected><Layout><ProjectDetail /></Layout></Protected>} />
      {/* Admin */}
      <Route path="/admin" element={<Protected><Layout><AdminDashboard /></Layout></Protected>} />
      <Route path="/admin/users" element={<Protected><Layout><AdminUsers /></Layout></Protected>} />
      <Route path="/admin/projects/:id" element={<Protected><Layout><AdminProjectDetail /></Layout></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
