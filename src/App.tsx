import { useEffect, useState, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from './stores/authStore';
import { useProfileStore } from './stores/profileStore';
import AdminHeader from './components/AdminHeader';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Callback from './components/Callback';

function FullSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
    </div>
  );
}

// Gate the dashboard behind an authenticated session. The is_admin check itself
// is handled inside AdminDashboard (it shows a Forbidden screen for non-admins).
function RequireAuth({ ready, children }: { ready: boolean; children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!ready) return <FullSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const checkAuthStatus = useAuthStore((s) => s.checkAuthStatus);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchProfile    = useProfileStore((s) => s.fetchProfile);
  const [ready, setReady] = useState(false);

  // Resolve the session once on load.
  useEffect(() => {
    checkAuthStatus().finally(() => setReady(true));
  }, [checkAuthStatus]);

  // Load the profile (for the is_admin gate) whenever auth is established.
  useEffect(() => {
    if (isAuthenticated) fetchProfile();
  }, [isAuthenticated, fetchProfile]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />
      <Route
        path="/"
        element={
          <RequireAuth ready={ready}>
            <div className="min-h-screen bg-slate-50">
              <AdminHeader />
              <AdminDashboard />
            </div>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
