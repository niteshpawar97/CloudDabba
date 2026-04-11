import { useState, useEffect } from 'react';
import { getDatabases, adminDeletePostgres, adminDeleteRedis } from '../../api/admin';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { Database, Trash2 } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminDatabases() {
  usePageTitle('Admin - Databases');
  const toast = useToast();
  const [databases, setDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const reload = () => getDatabases().then(setDatabases).catch(() => {});

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const handleDeletePg = async (projectId: string, dbName: string) => {
    if (!confirm(`Delete PostgreSQL database "${dbName}"? This is permanent.`)) return;
    setDeleting(`pg-${projectId}`);
    try {
      await adminDeletePostgres(projectId);
      toast.success(`PostgreSQL "${dbName}" deleted`);
      await reload();
    } catch { toast.error('Failed to delete'); }
    setDeleting(null);
  };

  const handleDeleteRedis = async (projectId: string, dbNum: number) => {
    if (!confirm(`Remove Redis db/${dbNum}?`)) return;
    setDeleting(`redis-${projectId}`);
    try {
      await adminDeleteRedis(projectId);
      toast.success(`Redis db/${dbNum} removed`);
      await reload();
    } catch { toast.error('Failed to delete'); }
    setDeleting(null);
  };

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Database className="h-7 w-7 text-green-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Provisioned Databases</h1>
          <p className="text-sm text-slate-500">{databases.length} project{databases.length !== 1 ? 's' : ''} with databases</p>
        </div>
      </div>

      {databases.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Database className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No databases provisioned yet</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">PostgreSQL</th>
                <th className="px-4 py-3 font-medium">Redis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {databases.map((db) => (
                <tr key={db.projectId} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{db.projectName}</div>
                    <div className="text-xs text-slate-500">{db.subdomain}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-300">{db.owner}</div>
                    <div className="text-xs text-slate-500">{db.ownerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    {db.postgres ? (
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="text-green-400 text-xs font-mono">{db.postgres.dbName}</span>
                          <div className="text-[10px] text-slate-500">{db.postgres.dbUser}</div>
                        </div>
                        <button
                          onClick={() => handleDeletePg(db.projectId, db.postgres.dbName)}
                          disabled={deleting === `pg-${db.projectId}`}
                          className="text-slate-600 hover:text-red-400 transition-colors ml-auto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {db.redis ? (
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xs font-mono">db/{db.redis.dbNumber}</span>
                        <button
                          onClick={() => handleDeleteRedis(db.projectId, db.redis.dbNumber)}
                          disabled={deleting === `redis-${db.projectId}`}
                          className="text-slate-600 hover:text-red-400 transition-colors ml-auto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
