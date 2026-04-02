import { useState, useEffect } from 'react';
import { getContainers, stopContainer } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Container, Square, RefreshCw } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminContainers() {
  usePageTitle('Admin - Containers');
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    getContainers().then(setContainers).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleStop = async (id: string, name: string) => {
    if (!confirm(`Stop container "${name}"?`)) return;
    await stopContainer(id);
    fetch();
  };

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Docker Containers</h1>
        <Button variant="secondary" size="sm" onClick={fetch}>
          <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh</span>
        </Button>
      </div>

      {containers.length === 0 ? (
        <div className="text-center py-16">
          <Container className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No CloudDabba containers running</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {containers.map((c) => (
            <div key={c.id} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Container className={`h-8 w-8 ${c.state === 'running' ? 'text-green-400' : 'text-slate-600'}`} />
                <div>
                  <div className="text-white font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{c.image}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <Badge variant={c.state === 'running' ? 'success' : 'default'}>{c.state}</Badge>
                  <div className="text-xs text-slate-500 mt-1">{c.status}</div>
                </div>

                {c.ports?.length > 0 && (
                  <div className="text-xs font-mono text-blue-400">
                    {c.ports.join(', ')}
                  </div>
                )}

                {c.state === 'running' && (
                  <Button variant="danger" size="sm" onClick={() => handleStop(c.id, c.name)}>
                    <Square className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
