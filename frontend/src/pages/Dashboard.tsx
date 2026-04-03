import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../api/projects';
import { getConfig } from '../api/config';
import { Project } from '../types/project';
import { ProjectCard } from '../components/ProjectCard';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Rocket, FolderOpen, CheckCircle, XCircle, Activity } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

function StatCard({ icon: Icon, value, label, neonColor, glowColor }: {
  icon: any; value: number; label: string; neonColor: string; glowColor: string;
}) {
  return (
    <div
      className="relative bg-[#141820] rounded-2xl p-5 border border-white/[0.06] overflow-hidden group hover:scale-[1.02] transition-all duration-300"
      style={{
        boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)',
      }}
    >
      {/* Neon glow bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${neonColor}, transparent)` }}
      />

      {/* Soft glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glowColor} 0%, transparent 70%)` }}
      />

      <div className="relative flex items-center gap-4">
        <div
          className="p-3 rounded-xl"
          style={{
            background: glowColor,
            boxShadow: `0 0 20px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`,
          }}
        >
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

  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;
  const failedCount = projects.filter((p) => p.status === 'FAILED').length;

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your deployed projects</p>
        </div>
        <Button onClick={() => navigate('/deploy')}>
          <span className="flex items-center gap-2">
            <Rocket className="h-4 w-4" /> New Deploy
          </span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FolderOpen} value={projects.length} label="Total Projects" neonColor="#3b82f6" glowColor="rgba(59,130,246,0.1)" />
        <StatCard icon={CheckCircle} value={activeCount} label="Active" neonColor="#22c55e" glowColor="rgba(34,197,94,0.1)" />
        <StatCard icon={XCircle} value={failedCount} label="Failed" neonColor="#ef4444" glowColor="rgba(239,68,68,0.1)" />
        <StatCard icon={Activity} value={projects.filter(p => p.deployments && p.deployments.length > 0).length} label="Deployed" neonColor="#a855f7" glowColor="rgba(168,85,247,0.1)" />
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} baseDomain={baseDomain} />
          ))}
        </div>
      )}
    </div>
  );
}
