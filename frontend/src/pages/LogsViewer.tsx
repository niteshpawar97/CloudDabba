import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDeployment, getDeploymentLogs } from '../api/deployments';
import { useDeploymentLogs } from '../hooks/useDeploymentLogs';
import { Deployment } from '../types/deployment';
import { LogLine } from '../types/log';
import { LogTerminal } from '../components/LogTerminal';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';

export function LogsViewer() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicalLogs, setHistoricalLogs] = useState<LogLine[]>([]);
  const { lines: liveLines, isConnected, isComplete } = useDeploymentLogs(deploymentId);

  // Load historical logs from DB
  useEffect(() => {
    if (deploymentId) {
      getDeploymentLogs(deploymentId)
        .then((data) => {
          const logs = data.logs.map((l: any) => ({
            type: l.type,
            message: l.message,
            timestamp: l.timestamp,
          }));
          setHistoricalLogs(logs);
        })
        .catch(() => {});
    }
  }, [deploymentId]);

  useEffect(() => {
    if (deploymentId) {
      getDeployment(deploymentId)
        .then(setDeployment)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [deploymentId]);

  // Poll deployment status
  useEffect(() => {
    if (!deploymentId || isComplete) return;
    const interval = setInterval(() => {
      getDeployment(deploymentId).then(setDeployment).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [deploymentId, isComplete]);

  // Merge historical + live logs, deduplicate by timestamp+message
  const allLines = [...historicalLogs];
  for (const line of liveLines) {
    const exists = allLines.some(
      (l) => l.timestamp === line.timestamp && l.message === line.message
    );
    if (!exists) allLines.push(line);
  }

  if (loading) return <Spinner size="lg" />;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link to={deployment ? `/projects/${deployment.projectId}` : '/'} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Deployment Logs</h1>
            <span className="text-sm text-slate-500 font-mono">{deploymentId?.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {deployment && <DeploymentStatusBadge status={deployment.status} />}
          <span className="flex items-center gap-1 text-xs">
            {isConnected ? (
              <><Wifi className="h-3 w-3 text-green-400" /> <span className="text-green-400">Connected</span></>
            ) : (
              <><WifiOff className="h-3 w-3 text-slate-500" /> <span className="text-slate-500">Disconnected</span></>
            )}
          </span>
        </div>
      </div>

      <LogTerminal lines={allLines} className="flex-1" />
    </div>
  );
}
