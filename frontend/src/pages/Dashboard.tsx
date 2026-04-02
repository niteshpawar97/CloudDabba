import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../api/projects';
import { getConfig } from '../api/config';
import { Project } from '../types/project';
import { ProjectCard } from '../components/ProjectCard';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Rocket, FolderOpen, CheckCircle, XCircle } from 'lucide-react';

export function Dashboard() {
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
          <p className="text-slate-400 text-sm mt-1">Manage your deployed projects</p>
        </div>
        <Button onClick={() => navigate('/deploy')}>
          <span className="flex items-center gap-2">
            <Rocket className="h-4 w-4" /> New Deploy
          </span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <FolderOpen className="h-8 w-8 text-blue-500" />
          <div>
            <div className="text-2xl font-bold text-white">{projects.length}</div>
            <div className="text-sm text-slate-400">Total Projects</div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div>
            <div className="text-2xl font-bold text-white">{activeCount}</div>
            <div className="text-sm text-slate-400">Active</div>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <XCircle className="h-8 w-8 text-red-500" />
          <div>
            <div className="text-2xl font-bold text-white">{failedCount}</div>
            <div className="text-sm text-slate-400">Failed</div>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16">
          <Rocket className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No projects yet</h3>
          <p className="text-slate-500 mb-6">Deploy your first project from GitHub</p>
          <Button onClick={() => navigate('/deploy')}>Deploy Now</Button>
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
