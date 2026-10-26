import { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { BackupEntry } from '../../api/projects';
import { getPlatformBackups, createPlatformBackup, deletePlatformBackup } from '../../api/admin';
import { downloadFile } from '../../utils/download';
import { fmtBytes } from '../../utils/format';

export function PlatformBackupsCard() {
  const [rows, setRows] = useState<BackupEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => getPlatformBackups().then(setRows).catch(() => {}), []);
  const running = rows.some((r) => r.status === 'RUNNING');

  useEffect(() => {
    load();
    const t = setInterval(load, running ? 3000 : 30000);
    return () => clearInterval(t);
  }, [load, running]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try { await fn(); await load(); } catch (e: any) { setErr(e?.response?.data?.message || 'Failed'); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2"><DatabaseBackup className="h-5 w-5 text-blue-400" /></div>
          <div>
            <h3 className="text-base font-semibold text-slate-200">Platform database backups</h3>
            <p className="text-xs text-slate-500">CloudDabba's own database (users, projects, settings). Daily, last 7 kept. Restore manually with psql.</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" disabled={busy || running} onClick={() => act(createPlatformBackup)}>
          {busy || running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Back up now'}
        </Button>
      </div>
      {err && <p className="text-xs text-red-400 mb-2">{err}</p>}
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">No platform backups yet.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0">
              <div className="min-w-0">
                <span className={b.status === 'SUCCESS' ? 'text-emerald-400' : b.status === 'FAILED' ? 'text-red-400' : 'text-amber-400'}>{b.status}</span>
                <span className="text-slate-500 ml-2">{b.trigger === 'AUTO' ? 'Auto' : 'Manual'}</span>
                {b.status === 'SUCCESS' && <span className="text-slate-500 ml-2">{fmtBytes(b.sizeBytes)}</span>}
                <p className="text-slate-600">{new Date(b.createdAt).toLocaleString()}</p>
                {b.error && <p className="text-red-400/80 truncate" title={b.error}>{b.error}</p>}
              </div>
              {b.status === 'SUCCESS' && (
                <div className="flex gap-1 shrink-0">
                  <button title="Download" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-blue-400"
                    onClick={() => downloadFile(`/admin/backups/${b.id}/download`, `${b.id}.sql.gz`).catch(() => setErr('Download failed'))}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button title="Delete" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400"
                    onClick={() => confirm('Delete this backup?') && act(() => deletePlatformBackup(b.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
