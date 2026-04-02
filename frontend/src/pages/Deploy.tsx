import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { RepoSelector } from '../components/RepoSelector';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Repository, Branch } from '../types/github';
import { ProjectType } from '../types/project';
import { getBranches } from '../api/github';
import { createProject } from '../api/projects';
import { triggerDeploy } from '../api/deployments';
import { getConfig, checkSubdomain } from '../api/config';
import { Rocket, Plus, Trash2, Upload, ClipboardPaste, FileText, Check, X } from 'lucide-react';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('NODE_BACKEND');
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
    try {
      const b = await getBranches(owner, repoName);
      setBranches(b);
    } catch {}
    setStep(2);
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

      const project = await createProject({
        name: projectName,
        repoUrl: selectedRepo.cloneUrl,
        branch: selectedBranch,
        projectType,
        subdomain: subdomain || undefined,
        envVars: Object.keys(envObj).length > 0 ? envObj : undefined,
      });

      const deployment = await triggerDeploy(project.id);
      navigate(`/logs/${deployment.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Deployment failed');
      setDeploying(false);
    }
  };

  if (!user?.hasPAT) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-white mb-2">GitHub not connected</h2>
        <p className="text-slate-400 mb-4">Add your GitHub PAT first to deploy repositories</p>
        <Button onClick={() => navigate('/github')}>Connect GitHub</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Rocket className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">Deploy a Project</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-blue-500' : 'bg-slate-700'}`} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">1. Select Repository</h2>
          <RepoSelector onSelect={handleRepoSelect} selected={selectedRepo} />
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

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200"
            >
              <option value="NODE_BACKEND">Node.js Backend</option>
              <option value="REACT_FRONTEND">React Frontend</option>
              <option value="STATIC_SITE">Static Site</option>
              <option value="FULLSTACK">Fullstack</option>
              <option value="CUSTOM_DOCKERFILE">Custom Dockerfile</option>
            </select>
          </div>

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
