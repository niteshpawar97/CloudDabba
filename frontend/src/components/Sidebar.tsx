import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, GitFork, Rocket, LogOut, Cloud, Keyboard } from 'lucide-react';
import { getProjects } from '../api/projects';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: 'Ctrl+H' },
  { to: '/github', icon: GitFork, label: 'GitHub', shortcut: '' },
  { to: '/deploy', icon: Rocket, label: 'Deploy', shortcut: 'Ctrl+D' },
];

export function Sidebar() {
  const { logout, user } = useAuth();
  const [activeCount, setActiveCount] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    getProjects()
      .then((projects) => {
        setActiveCount(projects.filter((p) => p.status === 'ACTIVE').length);
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="w-64 h-full bg-[#0c0e14] border-r border-white/[0.06] flex flex-col overflow-y-auto">
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10">
            <Cloud className="h-6 w-6 text-blue-400" />
          </div>
          <span className="text-lg font-bold text-white">CloudDabba</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label, shortcut }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-blue-500/15 text-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.08)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="flex-1">{label}</span>

            {/* Badge for Dashboard */}
            {to === '/dashboard' && activeCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-green-500/15 text-green-400 border border-green-500/20">
                {activeCount}
              </span>
            )}

            {/* Shortcut hint */}
            {shortcut && showShortcuts && (
              <span className="text-[10px] text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono">
                {shortcut}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 space-y-2 border-t border-white/[0.06]">
        {/* Shortcut toggle */}
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className={clsx(
            'flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg w-full transition-colors',
            showShortcuts ? 'text-blue-400 bg-blue-500/10' : 'text-slate-600 hover:text-slate-400'
          )}
        >
          <Keyboard className="h-3.5 w-3.5" />
          Shortcuts {showShortcuts ? 'ON' : ''}
        </button>

        {user?.role === 'admin' && (
          <NavLink to="/admin" className="flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400 px-3 py-1.5 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Admin Panel
          </NavLink>
        )}

        <div className="px-3 py-2">
          <div className="text-xs text-slate-500 truncate">{user?.email}</div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors w-full px-3 py-1.5 rounded-lg hover:bg-red-500/5"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
