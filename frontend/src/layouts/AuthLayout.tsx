import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Cloud } from 'lucide-react';

export function AuthLayout() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;
  if (token) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Cloud className="h-12 w-12 text-blue-500 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">CloudDabba</h1>
          <p className="text-slate-400 text-sm mt-1">Self-hosted PaaS Platform</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
