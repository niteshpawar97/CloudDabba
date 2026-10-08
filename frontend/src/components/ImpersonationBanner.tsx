import { useAuth } from '../hooks/useAuth';

/** Shown while an admin is logged in as another user; restores the admin session. */
export function ImpersonationBanner() {
  const { user } = useAuth();
  let adminToken: string | null = null;
  try { adminToken = localStorage.getItem('adminToken'); } catch { /* ignore */ }
  if (!adminToken || !user) return null;

  const back = () => {
    localStorage.setItem('token', adminToken!);
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/users';
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border border-amber-500/30 bg-[#1a1405] px-4 py-2 shadow-lg">
      <span className="text-xs text-amber-300">Viewing as <b>{user.name}</b> ({user.email})</span>
      <button onClick={back} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-black hover:bg-amber-400">
        Return to admin
      </button>
    </div>
  );
}
