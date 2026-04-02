import { useState, FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { storeGitHubPAT } from '../api/auth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { RepoSelector } from '../components/RepoSelector';
import { Repository } from '../types/github';
import { useNavigate } from 'react-router-dom';
import { GitFork, CheckCircle, Key } from 'lucide-react';
import { usePageTitle } from '../hooks/usePageTitle';

export function GitHubIntegration() {
  usePageTitle('GitHub Integration');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pat, setPat] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPATForm, setShowPATForm] = useState(!user?.hasPAT);

  const handleSavePAT = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await storeGitHubPAT(pat);
      setPat('');
      setShowPATForm(false);
      window.location.reload(); // Refresh user data
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save PAT');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectRepo = (repo: Repository) => {
    navigate(`/deploy?repo=${encodeURIComponent(repo.cloneUrl)}&name=${encodeURIComponent(repo.name)}&branch=${encodeURIComponent(repo.defaultBranch)}`);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <GitFork className="h-8 w-8 text-white" />
        <div>
          <h1 className="text-2xl font-bold text-white">GitHub Integration</h1>
          <p className="text-slate-400 text-sm mt-1">Connect your GitHub account to deploy repositories</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Personal Access Token</h2>
          </div>
          {user?.hasPAT && !showPATForm && (
            <div className="flex items-center gap-3">
              <Badge variant="success">
                <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Connected</span>
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setShowPATForm(true)}>
                Update
              </Button>
            </div>
          )}
        </div>

        {showPATForm && (
          <form onSubmit={handleSavePAT} className="space-y-3">
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <Input
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              required
            />
            <p className="text-xs text-slate-500">
              Generate a token at GitHub Settings &gt; Developer Settings &gt; Personal Access Tokens.
              Required scopes: repo (full access).
            </p>
            <div className="flex gap-2">
              <Button type="submit" loading={saving} size="sm">Save Token</Button>
              {user?.hasPAT && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPATForm(false)}>Cancel</Button>
              )}
            </div>
          </form>
        )}
      </div>

      {user?.hasPAT && !showPATForm && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Your Repositories</h2>
          <RepoSelector onSelect={handleSelectRepo} />
        </div>
      )}
    </div>
  );
}
