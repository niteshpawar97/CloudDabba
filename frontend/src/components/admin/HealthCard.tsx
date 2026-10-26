import { useEffect, useState } from 'react';
import { HeartPulse, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getHealth, HealthStatus } from '../../api/admin';

const KIND_LABEL: Record<string, string> = {
  unhealthy: 'Unhealthy',
  restarting: 'Crash-looping',
  down: 'Down (marked LIVE)',
};

function ago(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

export function HealthCard() {
  const [h, setH] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const load = () => getHealth().then(setH).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (!h) return null;
  const healthy = h.daemon.ok && h.issues.length === 0;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${healthy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            <HeartPulse className={`h-5 w-5 ${healthy ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <h2 className="text-lg font-semibold text-white">Docker Health</h2>
        </div>
        <p className="text-xs text-slate-400">{h.containers.running}/{h.containers.total} containers running</p>
      </div>

      {!h.daemon.ok && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-3">
          <p className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Docker daemon needs attention
          </p>
          <p className="text-xs text-red-200/80 mt-2 break-words">{h.daemon.error}</p>
          {h.daemon.hint && <p className="text-xs text-slate-300 mt-2">{h.daemon.hint}</p>}
        </div>
      )}

      {h.issues.length > 0 && (
        <div className="space-y-1.5">
          {h.issues.map((i) => (
            <div key={`${i.kind}:${i.id}`} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-white/[0.04] last:border-0">
              <div className="min-w-0">
                <span className="text-white font-medium">{i.name}</span>
                {i.projectName && <span className="text-slate-500 ml-2">{i.projectName}</span>}
                {!i.managed && <span className="text-slate-600 ml-2">(not managed by CloudDabba)</span>}
                <p className="text-slate-500 truncate">{i.status}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={i.confirmed ? 'text-red-400' : 'text-amber-400'}>{KIND_LABEL[i.kind]}</span>
                <p className="text-slate-600">for {ago(i.since)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {healthy && (
        <p className="text-sm text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Docker daemon is responding and all containers look healthy.
        </p>
      )}
    </div>
  );
}
