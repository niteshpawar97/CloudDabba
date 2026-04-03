import { useNavigate } from 'react-router-dom';
import { Card } from './ui/Card';
import { DeploymentStatusBadge } from './DeploymentStatusBadge';
import { Project } from '../types/project';
import { GitBranch, Globe, Clock, Container, FileCode2, Layout, FileText } from 'lucide-react';

const STATUS_NEON: Record<string, string> = {
  ACTIVE: 'green',
  FAILED: 'rose',
  INACTIVE: 'amber',
  BUILDING: 'blue',
};

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  NODE_BACKEND: { icon: Container, label: 'Node.js', color: 'text-green-400' },
  REACT_FRONTEND: { icon: Layout, label: 'Frontend', color: 'text-cyan-400' },
  NEXTJS_APP: { icon: FileCode2, label: 'Next.js', color: 'text-white' },
  STATIC_SITE: { icon: FileText, label: 'Static', color: 'text-amber-400' },
  FULLSTACK: { icon: Container, label: 'Fullstack', color: 'text-purple-400' },
  CUSTOM_DOCKERFILE: { icon: Container, label: 'Custom', color: 'text-slate-400' },
};

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

export function ProjectCard({ project, baseDomain }: { project: Project; baseDomain?: string }) {
  const navigate = useNavigate();
  const latestDeploy = project.deployments?.[0];
  const domain = baseDomain || 'clouddabba.dev';
  const subdomainUrl = `https://${project.subdomain}.${domain}`;
  const neon = STATUS_NEON[project.status] || 'blue';
  const typeConfig = TYPE_CONFIG[project.projectType] || TYPE_CONFIG.NODE_BACKEND;
  const TypeIcon = typeConfig.icon;
  const isLive = latestDeploy?.status === 'LIVE';

  return (
    <Card onClick={() => navigate(`/projects/${project.id}`)} neon={neon} interactive>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
            </span>
          )}
          <h3 className="text-lg font-semibold text-white">{project.name}</h3>
        </div>
        {latestDeploy && <DeploymentStatusBadge status={latestDeploy.status} />}
      </div>

      <div className="space-y-2.5 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-green-400" />
          <a href={subdomainUrl} target="_blank" onClick={(e) => e.stopPropagation()} className="text-green-400 hover:underline truncate">
            {project.subdomain}.{domain}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span>{project.branch}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{relativeTime(project.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
          <span className="text-xs text-slate-500 uppercase tracking-wider">{typeConfig.label}</span>
        </div>
        {latestDeploy?.commitHash && (
          <span className="text-[10px] font-mono text-slate-600">{latestDeploy.commitHash.slice(0, 7)}</span>
        )}
      </div>
    </Card>
  );
}
