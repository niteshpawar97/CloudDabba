import { useState, useEffect } from 'react';
import { getChangelog } from '../../api/admin';
import { Spinner } from '../../components/ui/Spinner';
import { History, Wrench, Sparkles, TrendingUp, Tag } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

interface Change {
  type: 'fix' | 'feature' | 'improvement';
  title: string;
  description: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  changes: Change[];
}

const typeConfig = {
  feature: { label: 'Feature', icon: Sparkles, bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  fix: { label: 'Fix', icon: Wrench, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  improvement: { label: 'Improvement', icon: TrendingUp, bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
};

export function AdminChangelog() {
  usePageTitle('Admin - Changelog');
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChangelog().then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <History className="h-7 w-7 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Changelog</h1>
          <p className="text-sm text-slate-500">Platform updates and fixes</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        {entries.map((entry, i) => (
          <div key={entry.version} className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            {/* Version header */}
            <div className={`px-6 py-4 border-b border-white/[0.06] flex items-center justify-between ${i === 0 ? 'bg-blue-500/5' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${i === 0 ? 'bg-blue-500/15' : 'bg-white/[0.04]'}`}>
                  <Tag className={`h-4 w-4 ${i === 0 ? 'text-blue-400' : 'text-slate-500'}`} />
                </div>
                <div>
                  <span className={`text-lg font-bold ${i === 0 ? 'text-blue-400' : 'text-white'}`}>v{entry.version}</span>
                  {i === 0 && <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">LATEST</span>}
                </div>
              </div>
              <span className="text-sm text-slate-500">{entry.date}</span>
            </div>

            {/* Changes list */}
            <div className="divide-y divide-white/[0.04]">
              {entry.changes.map((change, j) => {
                const cfg = typeConfig[change.type];
                const Icon = cfg.icon;
                return (
                  <div key={j} className="px-6 py-4 flex gap-4">
                    <div className={`mt-0.5 p-1.5 rounded-lg ${cfg.bg} shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                        <span className="text-sm font-medium text-white">{change.title}</span>
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{change.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No changelog entries yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
