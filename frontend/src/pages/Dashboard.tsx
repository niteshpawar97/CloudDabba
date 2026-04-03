import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../api/projects';
import { getConfig } from '../api/config';
import { Project } from '../types/project';
import { ProjectCard } from '../components/ProjectCard';
import { Button } from '../components/ui/Button';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Rocket, FolderOpen, CheckCircle, XCircle, Activity, Clock } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../hooks/useAuth';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatCard({ icon: Icon, value, label, neonColor, glowColor }: {
  icon: any; value: number; label: string; neonColor: string; glowColor: string;
}) {
  return (
    <div
      className="relative bg-[#141820] rounded-2xl p-5 border border-white/[0.06] overflow-hidden group hover:scale-[1.02] transition-all duration-300"
      style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${neonColor}, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glowColor} 0%, transparent 70%)` }} />
      <div className="relative flex items-center gap-4">
        <div className="p-3 rounded-xl" style={{ background: glowColor, boxShadow: `0 0 20px ${glowColor}` }}>
          <Icon className="h-6 w-6" style={{ color: neonColor }} />
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseDomain, setBaseDomain] = useState('clouddabba.dev');
  const navigate = useNavigate();

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
    getConfig().then((c) => setBaseDomain(c.baseDomain)).catch(() => {});
  }, []);

  if (loading) return <DashboardSkeleton />;

  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const failedCount = projects.filter((p) => p.status === 'FAILED').length;
  const deployedCount = projects.filter((p) => p.deployments && p.deployments.length > 0).length;

  // Gather recent deployments across all projects
  const recentDeploys = projects
    .flatMap((p) => (p.deployments || []).map((d: any) => ({ ...d, projectName: p.name, projectId: p.id })))
    .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 5);

  const lastDeployTime = recentDeploys[0]?.startedAt;

  return (
    <div>
      {/* Welcome Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Developer'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {lastDeployTime ? `Last deploy ${relativeTime(lastDeployTime)}` : 'Ready to deploy your first project'}
          </p>
        </div>
        <Button onClick={() => navigate('/deploy')}>
          <span className="flex items-center gap-2">
            <Rocket className="h-4 w-4" /> New Deploy
          </span>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FolderOpen} value={projects.length} label="Total Projects" neonColor="#3b82f6" glowColor="rgba(59,130,246,0.1)" />
        <StatCard icon={CheckCircle} value={activeCount} label="Active" neonColor="#22c55e" glowColor="rgba(34,197,94,0.1)" />
        <StatCard icon={XCircle} value={failedCount} label="Failed" neonColor="#ef4444" glowColor="rgba(239,68,68,0.1)" />
        <StatCard icon={Activity} value={deployedCount} label="Deployed" neonColor="#a855f7" glowColor="rgba(168,85,247,0.1)" />
      </div>

      {/* Recent Activity Timeline */}
      {recentDeploys.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h2>
          <div className="bg-[#141820] border border-white/[0.06] rounded-2xl overflow-hidden"
            style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)' }}>
            {recentDeploys.map((deploy: any, i: number) => (
              <div
                key={deploy.id}
                onClick={() => navigate(`/logs/${deploy.id}`)}
                className={`flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors ${
                  i < recentDeploys.length - 1 ? 'border-b border-white/[0.04]' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <DeploymentStatusBadge status={deploy.status} />
                  <div>
                    <span className="text-sm font-medium text-white">{deploy.projectName}</span>
                    {deploy.commitHash && (
                      <span className="text-xs text-slate-600 font-mono ml-2">{deploy.commitHash.slice(0, 7)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {relativeTime(deploy.startedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div
          className="text-center py-16 rounded-2xl bg-[#141820] border border-white/[0.06]"
          style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)' }}
        >
          <div className="p-4 rounded-2xl bg-blue-500/10 inline-block mb-4" style={{ boxShadow: '0 0 30px rgba(59,130,246,0.15)' }}>
            <Rocket className="h-12 w-12 text-blue-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">No projects yet</h3>
          <p className="text-slate-500 mb-6">Deploy your first project from GitHub</p>
          <Button onClick={() => navigate('/deploy')} size="lg">
            <span className="flex items-center gap-2"><Rocket className="h-4 w-4" /> Deploy Now</span>
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Your Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} baseDomain={baseDomain} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
