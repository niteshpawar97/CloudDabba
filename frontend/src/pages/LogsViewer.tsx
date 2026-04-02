import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDeployment, getDeploymentLogs } from '../api/deployments';
import { getConfig } from '../api/config';
import { useDeploymentLogs } from '../hooks/useDeploymentLogs';
import { useContainerLogs } from '../hooks/useContainerLogs';
import { Deployment } from '../types/deployment';
import { LogLine } from '../types/log';
import { LogTerminal } from '../components/LogTerminal';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { ArrowLeft, Wifi, WifiOff, Globe, Server, Clock, GitBranch, ExternalLink, CheckCircle, XCircle, Terminal, Hammer } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

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

function DeploymentReport({ deployment, baseDomain }: { deployment: DeploymentWithProject; baseDomain: string }) {
  const project = deployment.project;
  if (!project) return null;

  const subdomain = `${project.subdomain}.${baseDomain}`;
  const subdomainUrl = `https://${subdomain}`;
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

      <div className="border-t border-slate-700 pt-4 space-y-2">
        <div className="text-slate-500 text-xs uppercase font-medium">Access</div>

        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-green-400" />
            <span className="text-sm text-slate-300">URL</span>
          </div>
          <a href={subdomainUrl} target="_blank" className="text-green-400 text-sm hover:underline flex items-center gap-1">
            {subdomain} <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2">
          <span className="text-sm text-slate-300">SSL</span>
          {subdomainUrl.startsWith('https') ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <CheckCircle className="h-3 w-3" /> Secured (HTTPS)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400 text-sm">
              HTTP only
            </span>
          )}
        </div>

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
  usePageTitle('Deployment Logs');
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const [deployment, setDeployment] = useState<DeploymentWithProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicalLogs, setHistoricalLogs] = useState<LogLine[]>([]);
  const [baseDomain, setBaseDomain] = useState('clouddabba.dev');
  const [activeTab, setActiveTab] = useState<'build' | 'runtime'>('build');
  const { lines: liveLines, isConnected, isComplete } = useDeploymentLogs(deploymentId);
  const { lines: containerLines, isConnected: containerConnected } = useContainerLogs(
    deploymentId,
    activeTab === 'runtime' && deployment?.status === 'LIVE'
  );

  useEffect(() => {
    getConfig().then((c) => setBaseDomain(c.baseDomain)).catch(() => {});
  }, []);

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

  // Auto-switch to runtime tab when deployment goes LIVE
  useEffect(() => {
    if (deployment?.status === 'LIVE' && isComplete) {
      setActiveTab('runtime');
    }
  }, [deployment?.status, isComplete]);

  // Build logs: merge historical + live
  const buildLines = [...historicalLogs];
  for (const line of liveLines) {
    const exists = buildLines.some(
      (l) => l.timestamp === line.timestamp && l.message === line.message
    );
    if (!exists) buildLines.push(line);
  }

  const isLive = deployment?.status === 'LIVE';
  const isBuildActive = !isComplete && (deployment?.status === 'BUILDING' || deployment?.status === 'DEPLOYING' || deployment?.status === 'CLONING' || deployment?.status === 'QUEUED');

  if (loading) return <Spinner size="lg" />;

  const showReport = deployment && (deployment.status === 'LIVE' || deployment.status === 'FAILED' || deployment.status === 'STOPPED');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link to={deployment ? `/projects/${deployment.projectId}` : '/'} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">
              {deployment?.project?.name || 'Deployment'} Logs
            </h1>
            <span className="text-sm text-slate-500 font-mono">{deploymentId?.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {deployment && <DeploymentStatusBadge status={deployment.status} />}
          <span className="flex items-center gap-1 text-xs">
            {(activeTab === 'build' ? isConnected : containerConnected) ? (
              <><Wifi className="h-3 w-3 text-green-400" /> <span className="text-green-400">Connected</span></>
            ) : (
              <><WifiOff className="h-3 w-3 text-slate-500" /> <span className="text-slate-500">Disconnected</span></>
            )}
          </span>
        </div>
      </div>

      {/* Deployment Report Card */}
      {showReport && deployment && <DeploymentReport deployment={deployment} baseDomain={baseDomain} />}

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setActiveTab('build')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'build'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
          }`}
        >
          <Hammer className="h-4 w-4" />
          Build Logs
          {isBuildActive && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          disabled={!isLive}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'runtime'
              ? 'bg-green-600 text-white'
              : isLive
                ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300'
                : 'bg-white/[0.02] text-slate-600 cursor-not-allowed'
          }`}
        >
          <Terminal className="h-4 w-4" />
          Runtime Logs
          {isLive && activeTab !== 'runtime' && containerLines.length > 0 && (
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </button>
        {!isLive && activeTab !== 'runtime' && (
          <span className="text-xs text-slate-600 ml-2">Runtime logs available when container is running</span>
        )}
      </div>

      {/* Log Terminal */}
      {activeTab === 'build' ? (
        <LogTerminal
          lines={buildLines}
          className="flex-1"
          title="Build & Deploy"
          loading={isBuildActive}
        />
      ) : (
        <LogTerminal
          lines={containerLines}
          className="flex-1"
          title="Container Runtime"
          loading={containerConnected}
        />
      )}
    </div>
  );
}
