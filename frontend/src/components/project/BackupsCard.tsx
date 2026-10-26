import { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Download, RotateCcw, Trash2, Loader2, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { BackupList, getBackups, createBackup, restoreBackup, deleteBackup } from '../../api/projects';
import { downloadFile } from '../../utils/download';
import { fmtBytes } from '../../utils/format';

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: 'text-emerald-400', FAILED: 'text-red-400', RUNNING: 'text-amber-400',
};
const TRIGGER_LABEL: Record<string, string> = { AUTO: 'Auto', MANUAL: 'Manual', PRE_RESTORE: 'Before restore' };

export function BackupsCard({ projectId, postgres, mariadb }: { projectId: string; postgres: boolean; mariadb: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<BackupList | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => getBackups(projectId).then(setData).catch(() => {}), [projectId]);

  const active = !!data && (data.restoring || data.backups.some((b) => b.status === 'RUNNING'));
  useEffect(() => {
    load();
    const t = setInterval(load, active ? 3000 : 20000);
    return () => clearInterval(t);
  }, [load, active]);

  if (!postgres && !mariadb) return null;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const restore = (id: string) => {
    if (!confirm('Restore this backup? Current data in the database will be REPLACED. A safety backup of the current data is taken first.')) return;
    run(`r-${id}`, () => restoreBackup(projectId, id), 'Restore started');
  };

  const lr = data?.lastRestore;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10"><DatabaseBackup className="h-5 w-5 text-blue-400" /></div>
          <div>
            <div className="text-sm font-semibold text-white">Database backups</div>
            <div className="text-xs text-slate-500">Daily automatic backup, last 7 kept. Redis is not backed up.</div>
          </div>
        </div>
        <div className="flex gap-2">
          {postgres && (
            <Button size="sm" variant="ghost" disabled={!!busy || data?.restoring}
              onClick={() => run('b-pg', () => createBackup(projectId, 'POSTGRES'), 'Backup started')}>
              {busy === 'b-pg' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" />PostgreSQL</span>}
            </Button>
          )}
          {mariadb && (
            <Button size="sm" variant="ghost" disabled={!!busy || data?.restoring}
              onClick={() => run('b-my', () => createBackup(projectId, 'MARIADB'), 'Backup started')}>
              {busy === 'b-my' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="flex items-center gap-1"><Plus className="h-3.5 w-3.5" />MariaDB</span>}
            </Button>
          )}
        </div>
      </div>

      {data?.restoring && (
        <p className="text-xs text-amber-400 mb-3 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Restore in progress...</p>
      )}
      {lr && !data?.restoring && (
        <p className={`text-xs mb-3 ${lr.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {lr.ok ? 'Last restore completed successfully.' : `Last restore failed: ${lr.error}`}
        </p>
      )}

      {!data || data.backups.length === 0 ? (
        <p className="text-xs text-slate-500">No backups yet. The first automatic backup runs within a day, or create one now.</p>
      ) : (
        <div className="space-y-1.5">
          {data.backups.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0">
              <div className="min-w-0">
                <span className={`font-medium ${STATUS_COLOR[b.status]}`}>{b.status}</span>
                <span className="text-slate-300 ml-2">{b.engine === 'POSTGRES' ? 'PostgreSQL' : 'MariaDB'}</span>
                <span className="text-slate-500 ml-2">{TRIGGER_LABEL[b.trigger]}</span>
                {b.status === 'SUCCESS' && <span className="text-slate-500 ml-2">{fmtBytes(b.sizeBytes)}</span>}
                <p className="text-slate-600">{new Date(b.createdAt).toLocaleString()}</p>
                {b.error && <p className="text-red-400/80 truncate" title={b.error}>{b.error}</p>}
              </div>
              {b.status === 'SUCCESS' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button title="Download" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-blue-400"
                    onClick={() => downloadFile(`/projects/${projectId}/backups/${b.id}/download`, `${b.id}.sql.gz`).catch(() => toast.error('Download failed'))}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button title="Restore" disabled={!!busy || data.restoring}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-amber-400 disabled:opacity-40"
                    onClick={() => restore(b.id)}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button title="Delete" disabled={!!busy}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 disabled:opacity-40"
                    onClick={() => confirm('Delete this backup?') && run(`d-${b.id}`, () => deleteBackup(projectId, b.id), 'Backup deleted')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
