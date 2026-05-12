import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { RepoSelector } from '../components/RepoSelector';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Repository, Branch } from '../types/github';
import { ProjectType } from '../types/project';
import { getBranches, scanRepo } from '../api/github';
import { scanPublicRepo, uploadZip } from '../api/source';
import { createProject } from '../api/projects';
import { triggerDeploy } from '../api/deployments';
import { getConfig, checkSubdomain } from '../api/config';
import { Rocket, Plus, Trash2, Upload, ClipboardPaste, FileText, Check, X, GitBranch, Globe, Scan, Container, Layout, FileCode2, Server } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';
import { useToast } from '../components/ui/Toast';

function parseEnvString(text: string): { key: string; value: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) return null;
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return { key, value };
    })
    .filter(Boolean) as { key: string; value: string }[];
}

export function Deploy() {
  usePageTitle('Deploy a Project');
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<'github' | 'public' | 'zip'>('github');
  const [publicRepoUrl, setPublicRepoUrl] = useState('');
  const [zipUploading, setZipUploading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('NODE_BACKEND');
  const [detectedType, setDetectedType] = useState<{ type: string; confidence: string; reason: string; structure?: any } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [backendPath, setBackendPath] = useState('backend');
  const [frontendPath, setFrontendPath] = useState('frontend');
  const [subdomain, setSubdomain] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [baseDomain, setBaseDomain] = useState('clouddabba.dev');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState('');
  const [envMode, setEnvMode] = useState<'manual' | 'paste' | null>(null);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    getConfig().then((c) => setBaseDomain(c.baseDomain)).catch(() => {});
  }, []);

  // Pre-fill from URL params
  useEffect(() => {
    const repoUrl = searchParams.get('repo');
    const name = searchParams.get('name');
    const branch = searchParams.get('branch');
    if (repoUrl && name) {
      setSelectedRepo({ cloneUrl: repoUrl, name, defaultBranch: branch || 'main', fullName: name } as Repository);
      setProjectName(name);
      setSubdomain(name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
      setSelectedBranch(branch || 'main');
      setStep(3);
    }
  }, [searchParams]);

  // Check subdomain availability
  useEffect(() => {
    if (!subdomain || subdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      checkSubdomain(subdomain)
        .then((res) => setSubdomainAvailable(res.available))
        .catch(() => setSubdomainAvailable(null));
    }, 500);
    return () => clearTimeout(timer);
  }, [subdomain]);

  const handleRepoSelect = async (repo: Repository) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setSubdomain(repo.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
    setSelectedBranch(repo.defaultBranch);

    const [owner, repoName] = repo.fullName.split('/');

    // Scan repo type + fetch branches in parallel
    setScanning(true);
    try {
      const [branches, scan] = await Promise.all([
        getBranches(owner, repoName).catch(() => []),
        scanRepo(owner, repoName).catch(() => null),
      ]);
      setBranches(branches);
      if (scan) {
        setDetectedType(scan);
        setProjectType(scan.type as ProjectType);
        if (scan.structure) {
          setBackendPath(scan.structure.backendPath || 'backend');
          setFrontendPath(scan.structure.frontendPath || 'frontend');
        }
      }
    } catch {}
    setScanning(false);
    setStep(2);
  };

  const handlePublicRepo = async () => {
    if (!publicRepoUrl) return;
    setScanning(true);
    try {
      const result = await scanPublicRepo(publicRepoUrl);
      const repoName = publicRepoUrl.split('/').pop()?.replace('.git', '') || 'my-app';
      setSelectedRepo({ cloneUrl: result.repoUrl, name: repoName, fullName: repoName, defaultBranch: result.branch } as Repository);
      setProjectName(repoName);
      setSubdomain(repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      setSelectedBranch(result.branch);
      if (result.detection) {
        setDetectedType(result.detection);
        setProjectType(result.detection.type as ProjectType);
      }
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to scan repo');
    }
    setScanning(false);
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipUploading(true);
    setError('');
    try {
      const result = await uploadZip(file);
      const name = file.name.replace(/\.(zip|tar\.gz|tgz)$/i, '');
      setSelectedRepo({ cloneUrl: `zip://${name}`, name, fullName: name, defaultBranch: 'main' } as Repository);
      setProjectName(name);
      setSubdomain(name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      if (result.detection) {
        setDetectedType(result.detection);
        setProjectType(result.detection.type as ProjectType);
      }
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
    }
    setZipUploading(false);
    e.target.value = '';
  };

  const handlePasteApply = () => {
    const parsed = parseEnvString(pasteText);
    if (parsed.length === 0) return;
    setEnvVars((prev) => [...prev, ...parsed]);
    setPasteText('');
    setEnvMode(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseEnvString(text);
      if (parsed.length > 0) {
        setEnvVars((prev) => [...prev, ...parsed]);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be uploaded again
    e.target.value = '';
  };

  const handleDeploy = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRepo) return;
    setDeploying(true);
    setError('');

    try {
      const envObj: Record<string, string> = {};
      envVars.forEach(({ key, value }) => {
        if (key.trim()) envObj[key.trim()] = value;
      });

      // Add fullstack paths to config
      if (projectType === 'FULLSTACK') {
        envObj['backendPath'] = backendPath || 'backend';
        envObj['frontendPath'] = frontendPath || 'frontend';
      }

      const project = await createProject({
        name: projectName,
        repoUrl: selectedRepo.cloneUrl,
        branch: selectedBranch,
        projectType,
        subdomain: subdomain || undefined,
        envVars: Object.keys(envObj).length > 0 ? envObj : undefined,
      });

      const deployment = await triggerDeploy(project.id);
      toast.success('Deployment triggered!');
      navigate(`/logs/${deployment.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Deployment failed');
      setError(err.response?.data?.message || 'Deployment failed');
      setDeploying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Rocket className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">Deploy a Project</h1>
      </div>

      {/* Animated Step Indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[
          { num: 1, label: 'Source' },
          { num: 2, label: 'Branch' },
          { num: 3, label: 'Deploy' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                  step > s.num
                    ? 'bg-green-500 text-white shadow-[0_0_16px_rgba(34,197,94,0.4)]'
                    : step === s.num
                      ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] animate-pulse'
                      : 'bg-[#1a1f2e] text-slate-500 border border-white/[0.08]'
                }`}
                style={{ boxShadow: step > s.num ? '0 0 16px rgba(34,197,94,0.3), inset 0 1px 0 rgba(255,255,255,0.2)' : step === s.num ? '0 0 20px rgba(59,130,246,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : undefined }}
              >
                {step > s.num ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <span className={`text-[10px] font-medium ${step >= s.num ? 'text-slate-300' : 'text-slate-600'}`}>{s.label}</span>
            </div>
            {i < 2 && (
              <div className={`h-[2px] flex-1 mx-1 rounded-full transition-all duration-500 ${step > s.num ? 'bg-green-500/50' : 'bg-white/[0.06]'}`} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">1. Choose Source</h2>

          {/* Source type tabs */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setSourceType('github')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-all ${sourceType === 'github' ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              <GitBranch className="h-4 w-4 mx-auto mb-1" />
              GitHub (Private)
            </button>
            <button onClick={() => setSourceType('public')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-all ${sourceType === 'public' ? 'bg-green-600/20 border-green-500/50 text-green-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              <Globe className="h-4 w-4 mx-auto mb-1" />
              Public Repo URL
            </button>
            <button onClick={() => setSourceType('zip')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium border transition-all ${sourceType === 'zip' ? 'bg-purple-600/20 border-purple-500/50 text-purple-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              <Upload className="h-4 w-4 mx-auto mb-1" />
              Upload ZIP
            </button>
          </div>

          {error && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg p-3 mb-4">{error}</div>}

          {/* GitHub PAT repos */}
          {sourceType === 'github' && (
            user?.hasPAT ? (
              <RepoSelector onSelect={handleRepoSelect} selected={selectedRepo} />
            ) : (
              <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl">
                <GitBranch className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-2">GitHub not connected</p>
                <p className="text-sm text-slate-500 mb-4">Add your PAT to access private repos</p>
                <Button onClick={() => navigate('/github')} size="sm">Connect GitHub</Button>
              </div>
            )
          )}

          {/* Public repo URL */}
          {sourceType === 'public' && (
            <div className="space-y-4">
              <Input
                label="Public Repository URL"
                value={publicRepoUrl}
                onChange={(e) => setPublicRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
              />
              <p className="text-xs text-slate-500">Paste any public GitHub, GitLab, or Bitbucket repository URL</p>
              <Button onClick={handlePublicRepo} loading={scanning} disabled={!publicRepoUrl}>
                <span className="flex items-center gap-2"><Rocket className="h-4 w-4" /> Scan & Continue</span>
              </Button>
            </div>
          )}

          {/* ZIP upload */}
          {sourceType === 'zip' && (
            <div className="space-y-4">
              <label className="block">
                <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors">
                  <Upload className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-300 font-medium mb-1">
                    {zipUploading ? 'Uploading...' : 'Drop your project here or click to browse'}
                  </p>
                  <p className="text-xs text-slate-500">Supports .zip and .tar.gz (max 100MB)</p>
                  <input type="file" accept=".zip,.tar.gz,.tgz" className="hidden" onChange={handleZipUpload} disabled={zipUploading} />
                </div>
              </label>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">2. Select Branch</h2>
          <div className="text-sm text-slate-400 mb-2">Repository: {selectedRepo?.fullName}</div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
            {branches.length === 0 && <option value={selectedBranch}>{selectedBranch}</option>}
          </select>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Next</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={handleDeploy} className="space-y-4">
          <h2 className="text-lg font-semibold text-white">3. Configure & Deploy</h2>

          {error && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg p-3">{error}</div>}

          <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Subdomain</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-app"
                  className="pr-8"
                />
                {subdomainAvailable === true && (
                  <Check className="absolute right-3 top-2.5 h-4 w-4 text-green-400" />
                )}
                {subdomainAvailable === false && (
                  <X className="absolute right-3 top-2.5 h-4 w-4 text-red-400" />
                )}
              </div>
              <span className="text-slate-500 text-sm">.{baseDomain}</span>
            </div>
            {subdomainAvailable === false && (
              <p className="text-red-400 text-xs mt-1">This subdomain is already taken</p>
            )}
            {subdomainAvailable === true && (
              <p className="text-green-400 text-xs mt-1">{subdomain}.{baseDomain} is available</p>
            )}
          </div>

          {/* Detection Preview Card */}
          {detectedType && !scanning && (
            <div className="bg-[#141820] border border-white/[0.06] rounded-2xl p-4 space-y-3"
              style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10">
                    <Scan className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="text-sm font-medium text-white">Smart Detection</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  detectedType.confidence === 'high' ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
                  detectedType.confidence === 'medium' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' :
                  'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                }`}>
                  {detectedType.confidence} confidence
                </span>
              </div>
              <div className="flex items-center gap-3 bg-[#0a0e14] rounded-xl px-3 py-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  {projectType === 'FULLSTACK' ? <Server className="h-5 w-5 text-purple-400" /> :
                   projectType === 'REACT_FRONTEND' ? <Layout className="h-5 w-5 text-cyan-400" /> :
                   projectType === 'NEXTJS_APP' ? <FileCode2 className="h-5 w-5 text-white" /> :
                   <Container className="h-5 w-5 text-green-400" />}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{detectedType.reason}</div>
                  {detectedType.structure && (
                    <div className="text-[11px] text-slate-500">
                      {detectedType.structure.backendFramework && `Backend: ${detectedType.structure.backendFramework}`}
                      {detectedType.structure.backendFramework && detectedType.structure.frontendFramework && ' · '}
                      {detectedType.structure.frontendFramework && `Frontend: ${detectedType.structure.frontendFramework}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {scanning && (
            <div className="bg-[#141820] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-blue-400">Scanning repository...</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f1218] border border-white/[0.06] text-slate-200 shadow-[inset_2px_2px_6px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.02)] focus:outline-none focus:border-blue-500/40 transition-all"
            >
              <option value="NODE_BACKEND">Node.js Backend / SSR (Express, NestJS, Nuxt, SvelteKit...)</option>
              <option value="REACT_FRONTEND">Frontend SPA (React, Vue, Angular, Svelte, Astro...)</option>
              <option value="NEXTJS_APP">Next.js Application</option>
              <option value="STATIC_SITE">Static Site (HTML/CSS/JS)</option>
              <option value="FULLSTACK">Fullstack (backend + frontend)</option>
              <option value="CUSTOM_DOCKERFILE">Custom Dockerfile</option>
              <option value="DOCKER_COMPOSE">Docker Compose (ERPNext, multi-service)</option>
            </select>
          </div>

          {/* Fullstack Config */}
          {projectType === 'FULLSTACK' && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-slate-300">Fullstack Configuration</div>
              {detectedType?.structure && (
                <div className="text-xs text-slate-500 bg-slate-800 rounded px-3 py-2">
                  Detected: {detectedType.structure.pattern === 'separate-dirs' ? 'Separate directories' :
                    detectedType.structure.pattern === 'root-backend' ? 'Root = backend' : 'Unknown'}
                  {detectedType.structure.backendFramework && ` | Backend: ${detectedType.structure.backendFramework}`}
                  {detectedType.structure.frontendFramework && ` | Frontend: ${detectedType.structure.frontendFramework}`}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Backend Path"
                  value={backendPath}
                  onChange={(e) => setBackendPath(e.target.value)}
                  placeholder="backend"
                />
                <Input
                  label="Frontend Path"
                  value={frontendPath}
                  onChange={(e) => setFrontendPath(e.target.value)}
                  placeholder="frontend"
                />
              </div>
              <p className="text-xs text-slate-500">
                Paths relative to repo root. Use "." if backend is in root.
              </p>
            </div>
          )}

          {/* Environment Variables Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-300">Environment Variables</label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}>
                  <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Add</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEnvMode(envMode === 'paste' ? null : 'paste')}>
                  <span className="flex items-center gap-1"><ClipboardPaste className="h-3 w-3" /> Paste .env</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <span className="flex items-center gap-1"><Upload className="h-3 w-3" /> Upload</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".env,.env.local,.env.production,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {/* Paste .env mode */}
            {envMode === 'paste' && (
              <div className="mb-3 space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Paste your .env content here...\n\nDB_HOST=localhost\nDB_PORT=5432\nAPI_KEY=your-key\n# Comments are ignored`}
                  className="w-full h-40 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-200 font-mono text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handlePasteApply} disabled={!pasteText.trim()}>
                    Apply
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEnvMode(null); setPasteText(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Key-value pairs */}
            {envVars.length > 0 && (
              <div className="space-y-2">
                {envVars.map((env, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="KEY" value={env.key} onChange={(e) => {
                      const updated = [...envVars];
                      updated[i].key = e.target.value;
                      setEnvVars(updated);
                    }} className="font-mono text-sm" />
                    <Input placeholder="value" value={env.value} onChange={(e) => {
                      const updated = [...envVars];
                      updated[i].value = e.target.value;
                      setEnvVars(updated);
                    }} className="font-mono text-sm" />
                    <button type="button" onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))} className="text-slate-500 hover:text-red-400 shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs text-slate-500">
                    <FileText className="h-3 w-3 inline mr-1" />
                    {envVars.length} variable{envVars.length !== 1 ? 's' : ''}
                  </span>
                  <button type="button" onClick={() => setEnvVars([])} className="text-xs text-slate-500 hover:text-red-400">
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {envVars.length === 0 && envMode !== 'paste' && (
              <div className="text-center py-4 border border-dashed border-slate-700 rounded-lg">
                <p className="text-sm text-slate-500">No environment variables added</p>
                <p className="text-xs text-slate-600 mt-1">Add manually, paste .env content, or upload a file</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button type="submit" loading={deploying} size="lg" className="flex-1">
              <span className="flex items-center justify-center gap-2">
                <Rocket className="h-4 w-4" /> Deploy
              </span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
