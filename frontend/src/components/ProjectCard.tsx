import { useNavigate } from 'react-router-dom';
import { Card } from './ui/Card';
import { DeploymentStatusBadge } from './DeploymentStatusBadge';
import { Project } from '../types/project';
import { GitBranch, Globe, Clock } from 'lucide-react';

export function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const latestDeploy = project.deployments?.[0];

  return (
    <Card onClick={() => navigate(`/projects/${project.id}`)} className="hover:border-blue-500/50">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">{project.name}</h3>
        {latestDeploy && <DeploymentStatusBadge status={latestDeploy.status} />}
      </div>

      <div className="space-y-2 text-sm text-slate-400">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-blue-400">{project.subdomain}.cloud.niketgroup.com</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span>{project.branch}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700">
        <span className="text-xs text-slate-500 uppercase">{project.projectType.replace('_', ' ')}</span>
      </div>
    </Card>
  );
}
