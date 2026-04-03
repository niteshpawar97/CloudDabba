import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Spinner } from '../../components/ui/Spinner';
import { LayoutDashboard, Users, FolderOpen, Container, Image, Terminal, Settings, Cloud, LogOut, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/admin/containers', icon: Container, label: 'Containers' },
  { to: '/admin/images', icon: Image, label: 'Images' },
  { to: '/admin/logs', icon: Terminal, label: 'Logs' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

export function AdminLayout() {
  const { user, token, isLoading, logout } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen bg-[#06080f]">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 bottom-0 w-64 bg-[#0a0e17] border-r border-white/5 flex flex-col z-30">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Cloud className="h-7 w-7 text-blue-500" />
            <div>
              <span className="text-lg font-bold text-white">CloudDabba</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Admin</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-400 transition-colors">
            <ArrowLeft className="h-4 w-4" /> User Panel
          </NavLink>
          <div className="text-xs text-slate-600 truncate">{user?.email}</div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors w-full">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 p-8 overflow-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
