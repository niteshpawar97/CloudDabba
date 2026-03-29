import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDeployment, getDeploymentLogs } from '../api/deployments';
import { useDeploymentLogs } from '../hooks/useDeploymentLogs';
import { Deployment } from '../types/deployment';
import { LogLine } from '../types/log';
import { LogTerminal } from '../components/LogTerminal';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { ArrowLeft, Wifi, WifiOff, Globe, Server, Clock, GitBranch, ExternalLink, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DeploymentWithProject extends Deployment {
  project?: {
    id: string;
    name: string;
    subdomain: string;
    repoUrl: string;
    branch: string;
    projectType: string;
    status: string;
  };
}

function DeploymentReport({ deployment }: { deployment: DeploymentWithProject }) {
  const project = deployment.project;
  if (!project) return null;

  const subdomain = `${project.subdomain}.cloud.niketgroup.com`;
  const subdomainUrl = `https://${subdomain}`;
  const directUrl = deployment.containerPort ? `http://129.159.16.65:${deployment.containerPort}` : null;
  const isLive = deployment.status === 'LIVE';
  const isFailed = deployment.status === 'FAILED';
  const duration = deployment.finishedAt && deployment.startedAt
    ? Math.round((new Date(deployment.finishedAt).getTime() - new Date(deployment.startedAt).getTime()) / 1000)
    : null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Deployment Report</h2>
        <DeploymentStatusBadge status={deployment.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Project Info */}
        <div className="space-y-2">
          <div className="text-slate-500 text-xs uppercase font-medium">Project</div>
          <div className="flex items-center gap-2 text-slate-300">
            <Server className="h-4 w-4 text-slate-500" />
            <span className="font-medium text-white">{project.name}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <GitBranch className="h-4 w-4 text-slate-500" />
            <span>{project.branch}</span>
          </div>
          <div className="text-slate-400">
            <span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{project.projectType.replace('_', ' ')}</span>
          </div>
        </div>

        {/* Deployment Info */}
        <div className="space-y-2">
          <div className="text-slate-500 text-xs uppercase font-medium">Details</div>
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>{new Date(deployment.startedAt).toLocaleString()}</span>
          </div>
          {duration !== null && (
            <div className="text-slate-400">
              Duration: <span className="text-white">{duration}s</span>
            </div>
          )}
          {deployment.commitHash && (
            <div className="text-slate-400 font-mono text-xs">
              Commit: <span className="text-blue-400">{deployment.commitHash.slice(0, 7)}</span>
            </div>
          )}
        </div>
      </div>

      {/* URLs & Access */}
      <div className="border-t border-slate-700 pt-4 space-y-2">
        <div className="text-slate-500 text-xs uppercase font-medium">Access</div>

        {/* Subdomain */}
        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-300">Subdomain</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={subdomainUrl} target="_blank" className="text-blue-400 text-sm hover:underline flex items-center gap-1">
              {subdomain} <ExternalLink className="h-3 w-3" />
            </a>
            {isLive ? (
              <AlertTriangle className="h-4 w-4 text-amber-400" title="SSL not configured" />
            ) : null}
          </div>
        </div>

        {/* Direct Port Access */}
        {directUrl && (
          <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-green-400" />
              <span className="text-sm text-slate-300">Direct Access</span>
            </div>
            <a href={directUrl} target="_blank" className="text-green-400 text-sm hover:underline flex items-center gap-1">
              {directUrl} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Port */}
        {deployment.containerPort && (
          <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-300">Container Port</span>
            <span className="text-white font-mono text-sm">{deployment.containerPort}</span>
          </div>
        )}

        {/* SSL Status */}
        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">SSL Status</span>
          <span className="flex items-center gap-1 text-amber-400 text-sm">
            <AlertTriangle className="h-3 w-3" /> Wildcard SSL required
          </span>
        </div>

        {/* Container Status */}
        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">Container</span>
          {isLive ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle className="h-3 w-3" /> Running
            </span>
          ) : isFailed ? (
            <span className="flex items-center gap-1 text-red-400 text-sm">
              <XCircle className="h-3 w-3" /> Failed
            </span>
          ) : (
            <span className="text-slate-400 text-sm">{deployment.status}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function LogsViewer() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const [deployment, setDeployment] = useState<DeploymentWithProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicalLogs, setHistoricalLogs] = useState<LogLine[]>([]);
  const { lines: liveLines, isConnected, isComplete } = useDeploymentLogs(deploymentId);

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

  useEffect(() => {
    if (!deploymentId || isComplete) return;
    const interval = setInterval(() => {
      getDeployment(deploymentId).then(setDeployment).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [deploymentId, isComplete]);

  const allLines = [...historicalLogs];
  for (const line of liveLines) {
    const exists = allLines.some(
      (l) => l.timestamp === line.timestamp && l.message === line.message
    );
    if (!exists) allLines.push(line);
  }

  if (loading) return <Spinner size="lg" />;

  const showReport = deployment && (deployment.status === 'LIVE' || deployment.status === 'FAILED' || deployment.status === 'STOPPED');

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

      {/* Deployment Report Card */}
      {showReport && deployment && <DeploymentReport deployment={deployment} />}

      <LogTerminal lines={allLines} className="flex-1" />
    </div>
  );
}
