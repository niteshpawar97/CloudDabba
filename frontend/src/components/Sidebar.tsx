import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, GitFork, Rocket, LogOut, Cloud } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/github', icon: GitFork, label: 'GitHub' },
  { to: '/deploy', icon: Rocket, label: 'Deploy' },
];

export function Sidebar() {
  const { logout, user } = useAuth();

  return (
    <aside className="w-64 bg-sidebar border-r border-slate-700/50 flex flex-col min-h-screen">
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Cloud className="h-8 w-8 text-blue-500" />
          <span className="text-xl font-bold text-white">CloudDabba</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:text-white hover:bg-sidebar-hover'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700/50">
        <div className="text-sm text-slate-400 mb-3 truncate">{user?.email}</div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
