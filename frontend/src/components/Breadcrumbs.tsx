import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  github: 'GitHub',
  projects: 'Projects',
  deploy: 'Deploy',
  logs: 'Logs',
  admin: 'Admin',
};

export function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);

  if (parts.length <= 1) return null;

  const crumbs = parts.map((part, i) => {
    const path = '/' + parts.slice(0, i + 1).join('/');
    const isLast = i === parts.length - 1;
    const label = ROUTE_LABELS[part] || (part.length > 8 ? part.slice(0, 8) + '...' : part);

    return { path, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-6">
      <Link to="/dashboard" className="hover:text-slate-300 transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-slate-700" />
          {crumb.isLast ? (
            <span className="text-slate-300">{crumb.label}</span>
          ) : (
            <Link to={crumb.path} className="hover:text-slate-300 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
