import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import { PageLoader } from "./components/ui";

// Route-level code splitting keeps the initial bundle small.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/auth/VerifyEmail"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Food = lazy(() => import("./pages/Food"));
const Scanner = lazy(() => import("./pages/Scanner"));
const ActivityPage = lazy(() => import("./pages/Activity"));
const Water = lazy(() => import("./pages/Water"));
const Sleep = lazy(() => import("./pages/Sleep"));
const Body = lazy(() => import("./pages/Body"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Achievements = lazy(() => import("./pages/Achievements"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const More = lazy(() => import("./pages/More"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, onboarded, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  if (!onboarded && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/welcome" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="food" element={<Food />} />
          <Route path="scan" element={<Scanner />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="water" element={<Water />} />
          <Route path="sleep" element={<Sleep />} />
          <Route path="body" element={<Body />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="more" element={<More />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
