import { useState, useEffect } from 'react';
import { getAllProjects, getAllDeployments } from '../../api/admin';
import { DeploymentStatusBadge } from '../../components/DeploymentStatusBadge';
import { Badge } from '../../components/ui/Badge';
import { Globe, GitBranch } from 'lucide-react';

export function AdminProjects() {
  const [tab, setTab] = useState<'projects' | 'deployments'>('projects');
  const [projects, setProjects] = useState<any>({ projects: [], pagination: {} });
  const [deployments, setDeployments] = useState<any>({ deployments: [], pagination: {} });
  const [, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    if (tab === 'projects') {
      getAllProjects().then(setProjects).catch(() => {}).finally(() => setLoading(false));
    } else {
      getAllDeployments(1, statusFilter).then(setDeployments).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab, statusFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Projects & Deployments</h1>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('projects')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'projects' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
          Projects ({projects.pagination.total || 0})
        </button>
        <button onClick={() => setTab('deployments')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'deployments' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
          Deployments ({deployments.pagination.total || 0})
        </button>
      </div>

      {tab === 'projects' && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-left">
                <th className="py-3 px-4 font-medium text-slate-400">Project</th>
                <th className="py-3 px-4 font-medium text-slate-400">Owner</th>
                <th className="py-3 px-4 font-medium text-slate-400">Type</th>
                <th className="py-3 px-4 font-medium text-slate-400">Status</th>
                <th className="py-3 px-4 font-medium text-slate-400">Subdomain</th>
              </tr>
            </thead>
            <tbody>
              {projects.projects?.map((p: any) => (
                <tr key={p.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="py-3 px-4">
                    <div className="text-white font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1"><GitBranch className="h-3 w-3" /> {p.branch}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-xs">{p.user?.name || '—'}</td>
                  <td className="py-3 px-4">
                    <Badge variant="info">{p.projectType?.replace('_', ' ')}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    {p.deployments?.[0] ? <DeploymentStatusBadge status={p.deployments[0].status} /> : <span className="text-slate-600 text-xs">Never deployed</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-blue-400 flex items-center gap-1"><Globe className="h-3 w-3" /> {p.subdomain}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.projects?.length === 0 && <div className="text-center py-8 text-slate-500">No projects</div>}
        </div>
      )}

      {tab === 'deployments' && (
        <>
          <div className="flex gap-2 mb-4">
            {['', 'LIVE', 'FAILED', 'BUILDING', 'STOPPED'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-xs font-medium ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-left">
                  <th className="py-3 px-4 font-medium text-slate-400">Project</th>
                  <th className="py-3 px-4 font-medium text-slate-400">User</th>
                  <th className="py-3 px-4 font-medium text-slate-400">Status</th>
                  <th className="py-3 px-4 font-medium text-slate-400">Port</th>
                  <th className="py-3 px-4 font-medium text-slate-400">Started</th>
                </tr>
              </thead>
              <tbody>
                {deployments.deployments?.map((d: any) => (
                  <tr key={d.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-white font-medium">{d.project?.name}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs">{d.project?.user?.name}</td>
                    <td className="py-3 px-4"><DeploymentStatusBadge status={d.status} /></td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-xs">{d.containerPort || '—'}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs">{new Date(d.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deployments.deployments?.length === 0 && <div className="text-center py-8 text-slate-500">No deployments</div>}
          </div>
        </>
      )}
    </div>
  );
}
