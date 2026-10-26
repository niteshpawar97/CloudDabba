import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getAuditLog, AuditEntry } from '../../api/admin';
import { Input } from '../../components/ui/Input';
import { usePageTitle } from '../../hooks/usePageTitle';

export function AdminAudit() {
  usePageTitle('Admin - Audit Log');
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      getAuditLog(page, action, actor)
        .then((d) => { setRows(d.logs); setPages(d.pagination.pages || 1); setTotal(d.pagination.total); })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [page, action, actor]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <span className="text-sm text-slate-400">{total} entries</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input placeholder="Filter by action (e.g. impersonate)" value={action}
            onChange={(e) => { setPage(1); setAction(e.target.value); }} className="pl-10" />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input placeholder="Filter by user email" value={actor}
            onChange={(e) => { setPage(1); setActor(e.target.value); }} className="pl-10" />
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-left">
              <th className="py-3 px-4 font-medium text-slate-400">When</th>
              <th className="py-3 px-4 font-medium text-slate-400">Who</th>
              <th className="py-3 px-4 font-medium text-slate-400">Action</th>
              <th className="py-3 px-4 font-medium text-slate-400">Target</th>
              <th className="py-3 px-4 font-medium text-slate-400">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/[0.04] align-top">
                <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="py-2.5 px-4 text-slate-300 text-xs">
                  {r.actorEmail || '-'}
                  {r.impersonatedBy && <span className="block text-amber-400">via admin {r.impersonatedBy}</span>}
                </td>
                <td className="py-2.5 px-4">
                  <span className={`font-mono text-xs ${r.action.includes('failed') ? 'text-red-400' : 'text-white'}`}>{r.action}</span>
                  {r.meta && Object.keys(r.meta).length > 0 && (
                    <p className="text-[11px] text-slate-500 break-all">{JSON.stringify(r.meta)}</p>
                  )}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-400">
                  {r.targetLabel || r.targetId || '-'}
                  {r.targetType && <span className="text-slate-600 ml-1">({r.targetType})</span>}
                </td>
                <td className="py-2.5 px-4 text-xs text-slate-500">{r.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="text-center py-8 text-slate-500">No audit entries</div>}
      </div>

      {pages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded bg-white/5 text-slate-300 disabled:opacity-40">Prev</button>
          <span className="text-slate-400">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded bg-white/5 text-slate-300 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
