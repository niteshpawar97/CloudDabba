import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, deleteProject } from '../api/projects';
import { triggerDeploy } from '../api/deployments';
import { Project } from '../types/project';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import { Globe, GitBranch, Rocket, Trash2, ExternalLink, Clock } from 'lucide-react';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (projectId) {
      getProject(projectId)
        .then(setProject)
        .catch(() => navigate('/'))
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleDeploy = async () => {
    if (!project) return;
    setDeploying(true);
    try {
      const deployment = await triggerDeploy(project.id);
      navigate(`/logs/${deployment.id}`);
    } catch {
      setDeploying(false);
    }
  };

  const handleDelete = async () => {
    if (!project || !confirm('Delete this project? This will stop all containers.')) return;
    await deleteProject(project.id);
    navigate('/');
  };

  if (loading) return <Spinner size="lg" />;
  if (!project) return null;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <a href={`http://${project.subdomain}.cloud.niketgroup.com`} target="_blank" className="text-blue-400 hover:underline flex items-center gap-1">
                {project.subdomain}.cloud.niketgroup.com <ExternalLink className="h-3 w-3" />
              </a>
            </span>
            <span className="flex items-center gap-1"><GitBranch className="h-4 w-4" /> {project.branch}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDeploy} loading={deploying}>
            <span className="flex items-center gap-2"><Rocket className="h-4 w-4" /> Redeploy</span>
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Deployment History</h2>
      <div className="space-y-2">
        {(!project.deployments || project.deployments.length === 0) && (
          <p className="text-slate-500 py-4">No deployments yet</p>
        )}
        {project.deployments?.map((dep) => (
          <Card
            key={dep.id}
            onClick={() => navigate(`/logs/${dep.id}`)}
            className="flex items-center justify-between py-3 px-4"
          >
            <div className="flex items-center gap-4">
              <DeploymentStatusBadge status={dep.status} />
              <span className="text-sm text-slate-400 font-mono">{dep.commitHash?.slice(0, 7) || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="h-4 w-4" />
              {new Date(dep.startedAt).toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
