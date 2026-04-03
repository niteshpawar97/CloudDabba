import { useState, useEffect } from 'react';
import { getContainers, stopContainer, removeContainer, cleanupContainers } from '../../api/admin';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { Container, Square, RefreshCw, Trash2 } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminContainers() {
  usePageTitle('Admin - Containers');
  const toast = useToast();
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const fetchData = () => {
    setLoading(true);
    getContainers().then(setContainers).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleStop = async (id: string, name: string) => {
    if (!confirm(`Stop container "${name}"?`)) return;
    await stopContainer(id);
    toast.success(`Container ${name} stopped`);
    fetchData();
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove container "${name}"? This cannot be undone.`)) return;
    await removeContainer(id);
    toast.success(`Container ${name} removed`);
    fetchData();
  };

  const handleCleanup = async () => {
    const exitedCount = containers.filter((c) => c.state !== 'running').length;
    if (!exitedCount) { toast.info('No exited containers to clean'); return; }
    if (!confirm(`Remove ${exitedCount} exited container(s)?`)) return;
    setCleaning(true);
    try {
      const result = await cleanupContainers();
      toast.success(`Removed ${result.removed} exited containers`);
      fetchData();
    } catch { toast.error('Cleanup failed'); }
    setCleaning(false);
  };

  if (loading) return <Spinner size="lg" />;

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const exitedCount = containers.filter((c) => c.state !== 'running').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Docker Containers</h1>
          <p className="text-sm text-slate-500 mt-1">
            {runningCount} running, {exitedCount} exited
          </p>
        </div>
        <div className="flex gap-2">
          {exitedCount > 0 && (
            <Button variant="danger" size="sm" onClick={handleCleanup} loading={cleaning}>
              <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Clean {exitedCount} Exited</span>
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh</span>
          </Button>
        </div>
      </div>

      {containers.length === 0 ? (
        <div className="text-center py-16">
          <Container className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No CloudDabba containers</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {containers.map((c) => (
            <div key={c.id} className="bg-[#141820] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Container className={`h-8 w-8 ${c.state === 'running' ? 'text-green-400' : 'text-slate-600'}`} />
                <div>
                  <div className="text-white font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{c.image}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <Badge variant={c.state === 'running' ? 'success' : 'default'}>{c.state}</Badge>
                  <div className="text-xs text-slate-500 mt-1">{c.status}</div>
                </div>

                {c.ports?.length > 0 && (
                  <div className="text-xs font-mono text-blue-400">
                    {c.ports.join(', ')}
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {c.state === 'running' && (
                    <Button variant="danger" size="sm" onClick={() => handleStop(c.id, c.name)} title="Stop">
                      <Square className="h-3 w-3" />
                    </Button>
                  )}
                  {c.state !== 'running' && (
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(c.id, c.name)} title="Remove">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
