import { useState, useEffect } from 'react';
import { getDatabases } from '../../api/admin';
import { Spinner } from '../../components/ui/Spinner';
import { Database } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminDatabases() {
  usePageTitle('Admin - Databases');
  const [databases, setDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDatabases().then(setDatabases).catch(() => {}).finally(() => setLoading(false));
  }, []);

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
                      <div>
                        <span className="text-green-400 text-xs font-mono">{db.postgres.dbName}</span>
                        <div className="text-[10px] text-slate-500">{db.postgres.dbUser}</div>
                      </div>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {db.redis ? (
                      <span className="text-red-400 text-xs font-mono">db/{db.redis.dbNumber}</span>
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
