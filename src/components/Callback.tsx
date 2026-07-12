import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export default function Callback() {
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const finish = async (session: unknown | null) => {
      if (settled) return;
      settled = true;
      if (!session) {
        setError('Authentication failed. Redirecting…');
        setTimeout(() => navigate('/login', { replace: true }), 2500);
        return;
      }
      await checkAuthStatus();
      navigate('/', { replace: true });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') finish(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) finish(session); });
    const timeout = setTimeout(() => finish(null), 8000);

    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, [checkAuthStatus, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center">
        {error ? (
          <div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl">{error}</div>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Completing sign in…</p>
          </>
        )}
      </div>
    </div>
  );
}
