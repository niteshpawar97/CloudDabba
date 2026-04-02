import { useState, useEffect } from 'react';
import { getAllDeployments } from '../../api/admin';
import { getDeploymentLogs } from '../../api/deployments';
import { LogTerminal } from '../../components/LogTerminal';
import { DeploymentStatusBadge } from '../../components/DeploymentStatusBadge';
import { LogLine } from '../../types/log';

export function AdminLogs() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    getAllDeployments(1, '').then((d) => {
      setDeployments(d.deployments || []);
      if (d.deployments?.length > 0) setSelectedId(d.deployments[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    getDeploymentLogs(selectedId).then((data) => {
      setLogs(data.logs.map((l: any) => ({ type: l.type, message: l.message, timestamp: l.timestamp })));
    }).catch(() => setLogs([]));
  }, [selectedId]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold text-white mb-6">Deployment Logs</h1>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Deployment list */}
        <div className="w-72 shrink-0 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-auto">
          {deployments.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors ${
                selectedId === d.id ? 'bg-blue-600/20' : 'hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium truncate">{d.project?.name}</span>
                <DeploymentStatusBadge status={d.status} />
              </div>
              <div className="text-xs text-slate-500">{d.project?.user?.name} &bull; {new Date(d.startedAt).toLocaleString()}</div>
            </button>
          ))}
          {deployments.length === 0 && <div className="text-center py-8 text-slate-500 text-sm">No deployments</div>}
        </div>

        {/* Log viewer */}
        <div className="flex-1 min-h-0">
          {selectedId ? (
            <LogTerminal lines={logs} className="h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">Select a deployment to view logs</div>
          )}
        </div>
      </div>
    </div>
  );
}
