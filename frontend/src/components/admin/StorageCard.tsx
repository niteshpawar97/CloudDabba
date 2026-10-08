import { useCallback, useEffect, useState } from 'react';
import { HardDrive, Layers, Database, ShieldCheck, Loader2, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  getStorageStatus, getStorageHistory, runSafeCleanup,
  StorageStatus, StorageCleanupEntry,
} from '../../api/admin';

function fmt(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

const barColor = (l: StorageStatus['level']) =>
  l === 'EMERGENCY' ? 'bg-red-500' : l === 'CLEANUP' ? 'bg-orange-500' : l === 'WARNING' ? 'bg-amber-400' : 'bg-emerald-500';

const statusColor = (s: string) =>
  s === 'SUCCESS' ? 'text-emerald-400' : s === 'SKIPPED' ? 'text-amber-400' : 'text-red-400';

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className="text-lg font-semibold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function StorageCard() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [history, setHistory] = useState<StorageCleanupEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([getStorageStatus(), getStorageHistory(10)]);
      setStatus(s);
      setHistory(h);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load storage status');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const cleanup = async () => {
    setBusy(true);
    setConfirm(false);
    setResult(null);
    try {
      const res = await runSafeCleanup();
      setResult({ ok: true, message: res.message });
    } catch (e: any) {
      setResult({ ok: false, message: e?.response?.data?.message || e?.message || 'Cleanup failed' });
    } finally {
      setBusy(false);
      load();
    }
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2"><HardDrive className="h-5 w-5 text-blue-400" /></div>
          <div>
            <h2 className="text-lg font-semibold text-white">Docker Storage</h2>
            <p className="text-xs text-slate-500">
              {status?.autoCleanupEnabled === false
                ? 'Automatic cleanup is disabled.'
                : status
                  ? `Auto: warn ${status.thresholds.warning}% · cleanup ${status.thresholds.cleanup}% · emergency ${status.thresholds.emergency}%`
                  : ' '}
            </p>
          </div>
        </div>
        {confirm ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button size="sm" onClick={cleanup}>Confirm</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy || !status || !!status.busy} onClick={() => setConfirm(true)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Safe Cleanup'}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {status && (
        <>
          <div className="mb-5">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-300">Disk usage</span>
              <span className="font-mono text-slate-300">
                {fmt(status.disk.usedBytes)} / {fmt(status.disk.totalBytes)} ({status.disk.usedPercent}%)
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full ${barColor(status.level)} transition-all`}
                style={{ width: `${Math.min(100, status.disk.usedPercent)}%` }}
              />
              {[status.thresholds.warning, status.thresholds.cleanup, status.thresholds.emergency].map((t) => (
                <span key={t} className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${t}%` }} />
              ))}
            </div>
            {status.level !== 'OK' && (
              <p className={`text-xs mt-1.5 ${status.level === 'WARNING' ? 'text-amber-400' : 'text-red-400'}`}>
                {status.level === 'WARNING'
                  ? 'Disk usage is high.'
                  : `${status.level === 'EMERGENCY' ? 'Emergency' : 'Automatic'} cleanup threshold reached.`}
              </p>
            )}
            {status.busy && <p className="text-xs mt-1.5 text-amber-400">Cleanup paused: {status.busy}.</p>}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Stat
              icon={Layers}
              label="Docker images"
              value={fmt(status.docker.images.totalBytes)}
              sub={`${status.docker.images.count} images · ${status.docker.images.unusedCount} unused`}
            />
            <Stat
              icon={Database}
              label="Build cache"
              value={fmt(status.docker.buildCache.totalBytes)}
              sub={`${fmt(status.docker.buildCache.reclaimableBytes)} reclaimable`}
            />
            <Stat icon={Sparkles} label="Reclaimable" value={fmt(status.reclaimableBytes)} sub="images + build cache" />
            <Stat
              icon={ShieldCheck}
              label="Volumes (protected)"
              value={fmt(status.docker.volumes.sizeBytes)}
              sub={`${status.docker.volumes.count} volumes · never auto-cleaned`}
            />
          </div>
        </>
      )}

      {result && (
        <div
          className={`mb-4 rounded-lg p-3 flex items-start gap-2 border ${
            result.ok ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'
          }`}
        >
          {result.ok
            ? <Check className="h-4 w-4 text-emerald-400 mt-0.5" />
            : <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />}
          <p className={`text-xs ${result.ok ? 'text-emerald-300' : 'text-red-300'}`}>{result.message}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-2">Cleanup history</h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No cleanups yet.</p>
        ) : (
          <div className="space-y-1.5">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0"
              >
                <div className="min-w-0">
                  <span className={`font-medium ${statusColor(h.status)}`}>{h.status}</span>
                  <span className="text-slate-400 ml-2">{h.trigger === 'AUTO' ? 'Auto' : 'Manual'} · {h.level}</span>
                  {h.details && <p className="text-slate-500 truncate">{h.details}</p>}
                </div>
                <div className="text-right shrink-0 text-slate-400">
                  <p>{h.usageBefore}%{h.usageAfter != null ? ` → ${h.usageAfter}%` : ''} · {fmt(h.bytesReclaimed)}</p>
                  <p className="text-slate-600">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
