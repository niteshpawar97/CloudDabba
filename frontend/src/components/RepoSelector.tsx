import { useState, useEffect } from 'react';
import { Repository } from '../types/github';
import { getRepos } from '../api/github';
import { Input } from './ui/Input';
import { Spinner } from './ui/Spinner';
import { Search, Lock, Globe } from 'lucide-react';

interface RepoSelectorProps {
  onSelect: (repo: Repository) => void;
  selected?: Repository | null;
}

export function RepoSelector({ onSelect, selected }: RepoSelectorProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getRepos()
      .then(setRepos)
      .catch((err) => setError(err.response?.data?.message || 'Failed to fetch repositories'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-400 text-center py-4">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="max-h-96 overflow-auto space-y-1 rounded-lg border border-slate-700">
        {filtered.length === 0 && (
          <div className="text-slate-500 text-center py-8">No repositories found</div>
        )}
        {filtered.map((repo) => (
          <div
            key={repo.id}
            onClick={() => onSelect(repo)}
            className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
              selected?.id === repo.id ? 'bg-blue-600/20 border-l-2 border-blue-500' : 'hover:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {repo.private ? <Lock className="h-4 w-4 text-amber-400" /> : <Globe className="h-4 w-4 text-slate-400" />}
              <div>
                <div className="text-sm font-medium text-white">{repo.fullName}</div>
                {repo.description && <div className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{repo.description}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {repo.language && <span className="bg-slate-700 px-2 py-0.5 rounded">{repo.language}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
