import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function AdminHeader() {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-orange-500" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">Rent Report Admin</div>
              <div className="text-[11px] text-slate-400">Internal dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user?.email && <span className="hidden sm:inline text-xs text-slate-500">{user.email}</span>}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
