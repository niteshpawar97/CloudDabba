import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Cloud, ArrowLeft } from 'lucide-react';

export function AuthLayout() {
  const { token, isLoading } = useAuth();

  if (isLoading) return null;
  if (token) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex bg-[#06080f] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-[120px]" />
      </div>

      {/* Left panel - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center p-12">
        <div className="max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-12 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CloudDabba</h1>
              <p className="text-sm text-slate-500">Self-hosted PaaS Platform</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white leading-snug mb-4">
            Deploy your apps in seconds,{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              own your cloud.
            </span>
          </h2>

          <p className="text-slate-400 leading-relaxed mb-8">
            Push any GitHub repo and watch it go live with auto-detection,
            Docker containers, free SSL, and custom subdomains.
          </p>

          <div className="space-y-4">
            {[
              { label: 'Smart Detection', desc: 'Auto-detects React, Express, TypeScript & more' },
              { label: 'Any Structure', desc: 'Monorepo, fullstack, single app — all supported' },
              { label: 'Zero Config', desc: 'No Dockerfile or deploy config needed' },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Cloud className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">CloudDabba</h1>
            </div>
            <p className="text-slate-500 text-sm">Self-hosted PaaS Platform</p>
          </div>

          {/* Form card */}
          <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm rounded-2xl p-8">
            <Outlet />
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 mt-6">
            By continuing, you agree to CloudDabba's Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
