import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import NewProject from "@/pages/NewProject";
import ProjectDetail from "@/pages/ProjectDetail";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminProjectDetail from "@/pages/AdminProjectDetail";

function Protected({ children }: { children: React.ReactNode }) {
  return useAuthStore((s) => s.isAuthenticated) ? <>{children}</> : <Navigate to="/auth/login" replace />;
}
function Guest({ children }: { children: React.ReactNode }) {
  return useAuthStore((s) => s.isAuthenticated) ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/login" element={<Guest><Login /></Guest>} />
      <Route path="/auth/register" element={<Guest><Register /></Guest>} />
      <Route path="/dashboard" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
      <Route path="/projects/new" element={<Protected><Layout><NewProject /></Layout></Protected>} />
      <Route path="/projects/:id" element={<Protected><Layout><ProjectDetail /></Layout></Protected>} />
      {/* Admin */}
      <Route path="/admin" element={<Protected><Layout><AdminDashboard /></Layout></Protected>} />
      <Route path="/admin/projects/:id" element={<Protected><Layout><AdminProjectDetail /></Layout></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
