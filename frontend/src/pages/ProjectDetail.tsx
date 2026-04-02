import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProject, deleteProject, getWebhookStatus, enableWebhook, disableWebhook } from '../api/projects';
import { triggerDeploy, stopDeployment, startDeployment, restartDeployment } from '../api/deployments';
import { getConfig, updateSubdomain, checkSubdomain } from '../api/config';
import { Project } from '../types/project';
import { DeploymentStatusBadge } from '../components/DeploymentStatusBadge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import { Globe, GitBranch, Rocket, Trash2, ExternalLink, Clock, Edit3, Check, X, Square, Play, RotateCw, Terminal, Webhook, Copy, CheckCircle } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

export function ProjectDetail() {
  usePageTitle('Project Details');
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
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

  // Webhook / auto-deploy
  const [webhookStatus, setWebhookStatus] = useState<{ autoDeploy: boolean; webhookUrl: string | null; hasSecret: boolean } | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    getConfig().then((c) => setBaseDomain(c.baseDomain)).catch(() => {});
  }, []);

  useEffect(() => {
    if (projectId) {
      getProject(projectId)
        .then(setProject)
        .catch(() => navigate('/'))
        .finally(() => setLoading(false));
      getWebhookStatus(projectId).then(setWebhookStatus).catch(() => {});
    }
  }, [projectId]);

  useEffect(() => {
    if (!newSubdomain || newSubdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      checkSubdomain(newSubdomain)
        .then((res) => setSubdomainAvailable(res.available))
        .catch(() => setSubdomainAvailable(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [newSubdomain]);

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
    navigate('/dashboard');
  };

  const handleSubdomainSave = async () => {
    if (!project || !newSubdomain || !subdomainAvailable) return;
    setSubdomainSaving(true);
    setSubdomainError('');
    try {
      await updateSubdomain(project.id, newSubdomain);
      const updated = await getProject(project.id);
      setProject(updated);
      setEditingSubdomain(false);
    } catch (err: any) {
      setSubdomainError(err.response?.data?.message || 'Failed to update subdomain');
    } finally {
      setSubdomainSaving(false);
    }
  };

  const handleEnableWebhook = async () => {
    if (!projectId) return;
    setWebhookLoading(true);
    try {
      const result = await enableWebhook(projectId);
      setWebhookStatus({ autoDeploy: true, webhookUrl: result.webhookUrl, hasSecret: true });
      setWebhookSecret(result.secret);
    } catch {}
    setWebhookLoading(false);
  };

  const handleDisableWebhook = async () => {
    if (!projectId) return;
    setWebhookLoading(true);
    try {
      await disableWebhook(projectId);
      setWebhookStatus({ autoDeploy: false, webhookUrl: null, hasSecret: false });
      setWebhookSecret(null);
    } catch {}
    setWebhookLoading(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <Spinner size="lg" />;
  if (!project) return null;

  const subdomainUrl = `https://${project.subdomain}.${baseDomain}`;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
            {editingSubdomain ? (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-400" />
                <div className="flex items-center gap-1">
                  <Input
                    value={newSubdomain}
                    onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="w-40 py-1 text-sm"
                    placeholder="subdomain"
                  />
                  <span className="text-slate-500">.{baseDomain}</span>
                  {subdomainAvailable === true && <Check className="h-4 w-4 text-green-400" />}
                  {subdomainAvailable === false && <X className="h-4 w-4 text-red-400" />}
                  <Button size="sm" onClick={handleSubdomainSave} loading={subdomainSaving} disabled={!subdomainAvailable}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSubdomain(false)}>Cancel</Button>
                </div>
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
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Auto-Deploy / Webhook Section */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${webhookStatus?.autoDeploy ? 'bg-green-500/10' : 'bg-white/5'}`}>
              <Webhook className={`h-5 w-5 ${webhookStatus?.autoDeploy ? 'text-green-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Auto-Deploy (Git Push)</h3>
              <p className="text-xs text-slate-500">
                {webhookStatus?.autoDeploy
                  ? 'Deploys automatically when you push to ' + project.branch
                  : 'Push to GitHub and auto-deploy — set up webhook'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={webhookStatus?.autoDeploy ? 'danger' : 'primary'}
            loading={webhookLoading}
            onClick={webhookStatus?.autoDeploy ? handleDisableWebhook : handleEnableWebhook}
          >
            {webhookStatus?.autoDeploy ? 'Disable' : 'Enable'}
          </Button>
        </div>

        {webhookStatus?.autoDeploy && (
          <div className="space-y-3">
            {/* Webhook URL */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono overflow-x-auto">
                  {webhookStatus.webhookUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(webhookStatus.webhookUrl!, 'url')}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  {copied === 'url' ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Secret (only shown once after enable) */}
            {webhookSecret && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">
                  Secret <span className="text-amber-400">(copy now — won't be shown again)</span>
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono overflow-x-auto">
                    {webhookSecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(webhookSecret, 'secret')}
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    {copied === 'secret' ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Setup instructions */}
            <div className="bg-slate-900/50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
              <div className="text-slate-400 font-medium mb-2">Setup in GitHub:</div>
              <div>1. Go to your repo → Settings → Webhooks → Add webhook</div>
              <div>2. Paste the <span className="text-white">Webhook URL</span> above</div>
              <div>3. Set Content type to <span className="text-white">application/json</span></div>
              <div>4. Paste the <span className="text-white">Secret</span> above</div>
              <div>5. Select <span className="text-white">"Just the push event"</span></div>
              <div>6. Click <span className="text-white">Add webhook</span> — done!</div>
            </div>
          </div>
        )}
      </Card>

      <h2 className="text-lg font-semibold text-white mb-4">Deployment History</h2>
      <div className="space-y-2">
        {(!project.deployments || project.deployments.length === 0) && (
          <p className="text-slate-500 py-4">No deployments yet</p>
        )}
        {project.deployments?.map((dep) => (
          <Card
            key={dep.id}
            className="flex items-center justify-between py-3 px-4"
          >
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/logs/${dep.id}`)}>
              <DeploymentStatusBadge status={dep.status} />
              <span className="text-sm text-slate-400 font-mono">{dep.commitHash?.slice(0, 7) || '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(dep.startedAt).toLocaleString()}
              </span>
              {dep.status === 'LIVE' && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/logs/${dep.id}`); }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium transition-colors"
                  title="View Runtime Logs"
                >
                  <Terminal className="h-3 w-3" /> Logs
                </button>
              )}
              {dep.containerId && (
                <div className="flex items-center gap-1">
                  {dep.status === 'LIVE' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); restartDeployment(dep.id).then(() => getProject(projectId!).then(setProject)); }}
                        className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-blue-400" title="Restart">
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if(confirm('Stop this deployment?')) stopDeployment(dep.id).then(() => getProject(projectId!).then(setProject)); }}
                        className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400" title="Stop">
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {dep.status === 'STOPPED' && (
                    <button onClick={(e) => { e.stopPropagation(); startDeployment(dep.id).then(() => getProject(projectId!).then(setProject)); }}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-green-400" title="Start">
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
