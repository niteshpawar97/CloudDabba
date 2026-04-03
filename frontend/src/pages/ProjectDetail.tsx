import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, deleteProject, getWebhookStatus, enableWebhook, disableWebhook, updateEnvVars, getDomainStatus, setCustomDomain, verifyCustomDomain, removeCustomDomain } from '../api/projects';
import { triggerDeploy, stopDeployment, startDeployment, restartDeployment } from '../api/deployments';
import { getConfig, updateSubdomain, checkSubdomain } from '../api/config';
import { Project } from '../types/project';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { ProjectDetailSkeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { Globe, GitBranch, Rocket, Trash2, ExternalLink, Clock, Edit3, Check, X, Square, Play, RotateCw, Terminal, Webhook, Copy, CheckCircle, Server, Eye, EyeOff, Plus, ChevronDown, ChevronUp, Timer, Link2, RefreshCw, AlertCircle } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

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

function deployDuration(start: string, end?: string | null) {
  if (!end) return null;
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export function ProjectDetail() {
  usePageTitle('Project Details');
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [baseDomain, setBaseDomain] = useState('clouddabba.dev');

  // Subdomain editing
  const [editingSubdomain, setEditingSubdomain] = useState(false);
  const [newSubdomain, setNewSubdomain] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [subdomainSaving, setSubdomainSaving] = useState(false);
  const [subdomainError, setSubdomainError] = useState('');

  // Webhook
  const [webhookStatus, setWebhookStatus] = useState<{ autoDeploy: boolean; webhookUrl: string | null; hasSecret: boolean } | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Custom domain
  const [domainStatus, setDomainStatus] = useState<{ customDomain: string | null; verified: boolean; instructions: any } | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);

  // Env vars
  const [showEnv, setShowEnv] = useState(false);
  const [envMasked, setEnvMasked] = useState(true);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [envSaving, setEnvSaving] = useState(false);

  useEffect(() => {
    getConfig().then((c) => setBaseDomain(c.baseDomain)).catch(() => {});
  }, []);

  useEffect(() => {
    if (projectId) {
      getProject(projectId).then(setProject).catch(() => navigate('/')).finally(() => setLoading(false));
      getWebhookStatus(projectId).then(setWebhookStatus).catch(() => {});
      getDomainStatus(projectId).then(setDomainStatus).catch(() => {});
    }
  }, [projectId]);

  useEffect(() => {
    if (!newSubdomain || newSubdomain.length < 3) { setSubdomainAvailable(null); return; }
    const t = setTimeout(() => { checkSubdomain(newSubdomain).then((r) => setSubdomainAvailable(r.available)).catch(() => setSubdomainAvailable(null)); }, 500);
    return () => clearTimeout(t);
  }, [newSubdomain]);

  const handleDeploy = async () => {
    if (!project) return;
    setDeploying(true);
    try {
      const deployment = await triggerDeploy(project.id);
      toast.success('Deployment triggered!');
      navigate(`/logs/${deployment.id}`);
    } catch {
      toast.error('Failed to trigger deployment');
      setDeploying(false);
    }
  };

  const handleDelete = async () => {
    if (!project || !confirm('Delete this project? This will stop all containers.')) return;
    await deleteProject(project.id);
    toast.info('Project deleted');
    navigate('/dashboard');
  };

  const handleSubdomainSave = async () => {
    if (!project || !newSubdomain || !subdomainAvailable) return;
    setSubdomainSaving(true); setSubdomainError('');
    try {
      await updateSubdomain(project.id, newSubdomain);
      const updated = await getProject(project.id);
      setProject(updated); setEditingSubdomain(false);
      toast.success('Subdomain updated!');
    } catch (err: any) {
      setSubdomainError(err.response?.data?.message || 'Failed');
    } finally { setSubdomainSaving(false); }
  };

  const handleEnableWebhook = async () => {
    if (!projectId) return;
    setWebhookLoading(true);
    try {
      const result = await enableWebhook(projectId);
      setWebhookStatus({ autoDeploy: true, webhookUrl: result.webhookUrl, hasSecret: true });
      setWebhookSecret(result.secret);
      toast.success('Auto-deploy enabled!');
    } catch { toast.error('Failed to enable webhook'); }
    setWebhookLoading(false);
  };

  const handleDisableWebhook = async () => {
    if (!projectId) return;
    setWebhookLoading(true);
    try {
      await disableWebhook(projectId);
      setWebhookStatus({ autoDeploy: false, webhookUrl: null, hasSecret: false });
      setWebhookSecret(null);
      toast.info('Auto-deploy disabled');
    } catch {}
    setWebhookLoading(false);
  };

  const handleSetDomain = async () => {
    if (!projectId || !newDomain.trim()) return;
    setDomainLoading(true);
    try {
      const result = await setCustomDomain(projectId, newDomain.trim());
      setDomainStatus(result);
      setNewDomain('');
      toast.success(result.verified ? 'Domain verified and active!' : 'Domain set — configure DNS records below');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to set domain');
    }
    setDomainLoading(false);
  };

  const handleVerifyDomain = async () => {
    if (!projectId) return;
    setDomainLoading(true);
    try {
      const result = await verifyCustomDomain(projectId);
      setDomainStatus(result);
      toast[result.verified ? 'success' : 'info'](result.verified ? 'Domain verified!' : 'DNS not pointing to CloudDabba yet');
    } catch (err: any) {
      toast.error('Verification failed');
    }
    setDomainLoading(false);
  };

  const handleRemoveDomain = async () => {
    if (!projectId || !confirm('Remove custom domain?')) return;
    setDomainLoading(true);
    try {
      await removeCustomDomain(projectId);
      setDomainStatus({ customDomain: null, verified: false, instructions: null });
      toast.info('Custom domain removed');
    } catch {}
    setDomainLoading(false);
  };

  const handleAddEnv = async () => {
    if (!project || !newEnvKey.trim()) return;
    setEnvSaving(true);
    try {
      const current = (project.envVars as Record<string, string>) || {};
      await updateEnvVars(project.id, { ...current, [newEnvKey.trim()]: newEnvValue });
      const updated = await getProject(project.id);
      setProject(updated);
      setNewEnvKey(''); setNewEnvValue('');
      toast.success('Environment variable added');
    } catch { toast.error('Failed to update env vars'); }
    setEnvSaving(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <ProjectDetailSkeleton />;
  if (!project) return null;

  const subdomainUrl = `https://${project.subdomain}.${baseDomain}`;
  const latestDeploy = project.deployments?.[0];
  const isLive = latestDeploy?.status === 'LIVE';
  const envVars = (project.envVars as Record<string, string>) || {};
  const envKeys = Object.keys(envVars).filter((k) => k !== 'backendPath' && k !== 'frontendPath');

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
              </span>
            )}
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
            {editingSubdomain ? (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-400" />
                <Input value={newSubdomain} onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} className="w-40 py-1 text-sm" placeholder="subdomain" />
                <span className="text-slate-500">.{baseDomain}</span>
                {subdomainAvailable === true && <Check className="h-4 w-4 text-green-400" />}
                {subdomainAvailable === false && <X className="h-4 w-4 text-red-400" />}
                <Button size="sm" onClick={handleSubdomainSave} loading={subdomainSaving} disabled={!subdomainAvailable}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingSubdomain(false)}>Cancel</Button>
                {subdomainError && <span className="text-red-400 text-xs">{subdomainError}</span>}
              </div>
            ) : (
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4 text-green-400" />
                <a href={subdomainUrl} target="_blank" className="text-green-400 hover:underline flex items-center gap-1">
                  {project.subdomain}.{baseDomain} <ExternalLink className="h-3 w-3" />
                </a>
                <button onClick={() => { setEditingSubdomain(true); setNewSubdomain(project.subdomain); }} className="text-slate-500 hover:text-blue-400 ml-1">
                  <Edit3 className="h-3 w-3" />
                </button>
              </span>
            )}
            <span className="flex items-center gap-1"><GitBranch className="h-4 w-4" /> {project.branch}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDeploy} loading={deploying}>
            <span className="flex items-center gap-2"><Rocket className="h-4 w-4" /> Redeploy</span>
          </Button>
          <Button variant="danger" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Health Overview */}
      {latestDeploy && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isLive ? 'bg-green-500/10' : 'bg-slate-500/10'}`}>
                <Server className={`h-5 w-5 ${isLive ? 'text-green-400' : 'text-slate-500'}`} />
              </div>
              <div>
                <div className="text-xs text-slate-500">Container</div>
                <div className={`text-sm font-semibold ${isLive ? 'text-green-400' : 'text-slate-400'}`}>
                  {isLive ? 'Running' : latestDeploy.status}
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Port</div>
                <div className="text-sm font-semibold text-white">{latestDeploy.containerPort || '—'}</div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Timer className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Last Deploy</div>
                <div className="text-sm font-semibold text-white">{relativeTime(latestDeploy.startedAt)}</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Auto-Deploy */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${webhookStatus?.autoDeploy ? 'bg-green-500/10' : 'bg-white/5'}`}>
              <Webhook className={`h-5 w-5 ${webhookStatus?.autoDeploy ? 'text-green-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Auto-Deploy (Git Push)</h3>
              <p className="text-xs text-slate-500">
                {webhookStatus?.autoDeploy ? `Auto-deploys on push to ${project.branch}` : 'Set up webhook for auto-deploy'}
              </p>
            </div>
          </div>
          <Button size="sm" variant={webhookStatus?.autoDeploy ? 'danger' : 'primary'} loading={webhookLoading} onClick={webhookStatus?.autoDeploy ? handleDisableWebhook : handleEnableWebhook}>
            {webhookStatus?.autoDeploy ? 'Disable' : 'Enable'}
          </Button>
        </div>
        {webhookStatus?.autoDeploy && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-[#0a0e14] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-300 font-mono overflow-x-auto">{webhookStatus.webhookUrl}</code>
                <button onClick={() => copyToClipboard(webhookStatus.webhookUrl!, 'url')} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                  {copied === 'url' ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {webhookSecret && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Secret <span className="text-amber-400">(copy now)</span></label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono overflow-x-auto">{webhookSecret}</code>
                  <button onClick={() => copyToClipboard(webhookSecret, 'secret')} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
                    {copied === 'secret' ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <div className="bg-[#0a0e14] rounded-xl p-3 text-xs text-slate-500 space-y-1">
              <div className="text-slate-400 font-medium mb-2">GitHub Setup:</div>
              <div>1. Repo → Settings → Webhooks → Add webhook</div>
              <div>2. Paste <span className="text-white">Webhook URL</span> + <span className="text-white">Secret</span></div>
              <div>3. Content type: <span className="text-white">application/json</span></div>
              <div>4. Select <span className="text-white">"Just the push event"</span></div>
            </div>
          </div>
        )}
      </Card>

      {/* Custom Domain */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${domainStatus?.customDomain ? (domainStatus.verified ? 'bg-green-500/10' : 'bg-amber-500/10') : 'bg-white/5'}`}>
              <Link2 className={`h-5 w-5 ${domainStatus?.customDomain ? (domainStatus.verified ? 'text-green-400' : 'text-amber-400') : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Custom Domain</h3>
              <p className="text-xs text-slate-500">
                {domainStatus?.customDomain
                  ? domainStatus.verified
                    ? `${domainStatus.customDomain} is active`
                    : `${domainStatus.customDomain} — DNS verification pending`
                  : 'Connect your own domain (e.g. example.com)'}
              </p>
            </div>
          </div>
          {domainStatus?.customDomain && (
            <Button size="sm" variant="danger" onClick={handleRemoveDomain} loading={domainLoading}>Remove</Button>
          )}
        </div>

        {/* Add domain form */}
        {!domainStatus?.customDomain && (
          <div className="flex items-center gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.toLowerCase().trim())}
              placeholder="example.com"
              className="flex-1"
            />
            <Button onClick={handleSetDomain} loading={domainLoading} disabled={!newDomain.trim()}>
              Add Domain
            </Button>
          </div>
        )}

        {/* Domain status + DNS instructions */}
        {domainStatus?.customDomain && (
          <div className="space-y-3">
            {/* Status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${domainStatus.verified ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
              {domainStatus.verified
                ? <><CheckCircle className="h-4 w-4 text-green-400" /><span className="text-sm text-green-400">Domain verified and active</span></>
                : <><AlertCircle className="h-4 w-4 text-amber-400" /><span className="text-sm text-amber-400">DNS verification pending</span></>
              }
            </div>

            {/* Live URL */}
            {domainStatus.verified && (
              <div className="flex items-center gap-2 bg-[#0a0e14] rounded-xl px-3 py-2.5">
                <Globe className="h-4 w-4 text-green-400" />
                <a href={`https://${domainStatus.customDomain}`} target="_blank" className="text-green-400 text-sm hover:underline flex items-center gap-1">
                  {domainStatus.customDomain} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* DNS Setup Instructions */}
            {!domainStatus.verified && domainStatus.instructions && (
              <div className="bg-[#0a0e14] rounded-xl p-4 space-y-3">
                <div className="text-xs text-slate-400 font-medium">Configure DNS at your domain registrar:</div>

                <div className="text-xs space-y-2">
                  <div className="text-slate-500 mb-1">Option 1: CNAME Record (recommended)</div>
                  <div className="grid grid-cols-3 gap-2 bg-white/[0.03] rounded-lg p-2.5">
                    <div><span className="text-slate-600">Type</span><br /><span className="text-blue-400 font-mono">CNAME</span></div>
                    <div><span className="text-slate-600">Name</span><br /><span className="text-white font-mono">{domainStatus.instructions.cname?.name || domainStatus.customDomain}</span></div>
                    <div><span className="text-slate-600">Value</span><br /><span className="text-green-400 font-mono">{domainStatus.instructions.cname?.value}</span></div>
                  </div>

                  <div className="text-slate-500 mt-3 mb-1">Option 2: A Record</div>
                  <div className="grid grid-cols-3 gap-2 bg-white/[0.03] rounded-lg p-2.5">
                    <div><span className="text-slate-600">Type</span><br /><span className="text-blue-400 font-mono">A</span></div>
                    <div><span className="text-slate-600">Name</span><br /><span className="text-white font-mono">@</span></div>
                    <div><span className="text-slate-600">Value</span><br /><span className="text-green-400 font-mono">{domainStatus.instructions.a?.value}</span></div>
                  </div>
                </div>

                <Button size="sm" variant="secondary" onClick={handleVerifyDomain} loading={domainLoading}>
                  <span className="flex items-center gap-2"><RefreshCw className="h-3.5 w-3.5" /> Verify DNS</span>
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Environment Variables */}
      <Card className="p-5 mb-6">
        <button onClick={() => setShowEnv(!showEnv)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-white">Environment Variables</div>
            {envKeys.length > 0 && (
              <span className="text-[10px] bg-white/[0.06] text-slate-400 px-2 py-0.5 rounded-md">{envKeys.length} vars</span>
            )}
          </div>
          {showEnv ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>

        {showEnv && (
          <div className="mt-4 space-y-3">
            {envKeys.length > 0 && (
              <div className="space-y-1.5">
                {envKeys.map((key) => (
                  <div key={key} className="flex items-center gap-2 bg-[#0a0e14] rounded-lg px-3 py-2 text-xs font-mono">
                    <span className="text-blue-400">{key}</span>
                    <span className="text-slate-600">=</span>
                    <span className="text-slate-400 flex-1 truncate">
                      {envMasked ? '••••••••' : envVars[key]}
                    </span>
                  </div>
                ))}
                <button onClick={() => setEnvMasked(!envMasked)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
                  {envMasked ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {envMasked ? 'Show values' : 'Hide values'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input value={newEnvKey} onChange={(e) => setNewEnvKey(e.target.value)} placeholder="KEY" className="flex-1 text-xs py-1.5 font-mono" />
              <Input value={newEnvValue} onChange={(e) => setNewEnvValue(e.target.value)} placeholder="value" className="flex-1 text-xs py-1.5 font-mono" />
              <Button size="sm" onClick={handleAddEnv} loading={envSaving} disabled={!newEnvKey.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Deployment History */}
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Deployment History</h2>
      <div className="space-y-2">
        {(!project.deployments || project.deployments.length === 0) && (
          <p className="text-slate-500 py-4">No deployments yet</p>
        )}
        {project.deployments?.map((dep) => {
          const duration = deployDuration(dep.startedAt, dep.finishedAt);
          return (
            <Card key={dep.id} className="flex items-center justify-between py-3 px-4">
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/logs/${dep.id}`)}>
                <DeploymentStatusBadge status={dep.status} />
                <span className="text-sm text-slate-400 font-mono">{dep.commitHash?.slice(0, 7) || '—'}</span>
                {duration && (
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <Timer className="h-3 w-3" /> {duration}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {relativeTime(dep.startedAt)}
                </span>
                {dep.status === 'LIVE' && (
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/logs/${dep.id}`); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium">
                    <Terminal className="h-3 w-3" /> Logs
                  </button>
                )}
                {dep.containerId && (
                  <div className="flex items-center gap-1">
                    {dep.status === 'LIVE' && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); restartDeployment(dep.id).then(() => getProject(projectId!).then(setProject)); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-blue-400" title="Restart"><RotateCw className="h-3.5 w-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); if (confirm('Stop?')) stopDeployment(dep.id).then(() => getProject(projectId!).then(setProject)); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400" title="Stop"><Square className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                    {dep.status === 'STOPPED' && (
                      <button onClick={(e) => { e.stopPropagation(); startDeployment(dep.id).then(() => getProject(projectId!).then(setProject)); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-green-400" title="Start"><Play className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
