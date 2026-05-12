import { useState } from 'react';
import { HardDrive, Trash2, Layers, Database, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { pruneContainers, pruneImages, pruneSystem } from '../../api/admin';

type Action = 'containers' | 'images' | 'system';

interface Result {
  kind: 'ok' | 'err';
  message: string;
}

export function DockerMaintenanceCard() {
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async (action: Action) => {
    setBusy(action);
    setResult(null);
    setConfirm(null);
    try {
      const fn = action === 'containers' ? pruneContainers : action === 'images' ? pruneImages : pruneSystem;
      const res = await fn();
      setResult({ kind: 'ok', message: res.message || 'Done' });
    } catch (e: any) {
      setResult({ kind: 'err', message: e?.response?.data?.message || e?.message || 'Failed' });
    } finally {
      setBusy(null);
    }
  };

  const items: Array<{
    key: Action;
    icon: any;
    title: string;
    desc: string;
    cmd: string;
    safety: 'safe' | 'caution' | 'warning';
    safetyText: string;
  }> = [
    {
      key: 'containers',
      icon: Trash2,
      title: 'Remove stopped containers',
      desc: 'Deletes containers in exited / dead state. Running containers are not touched.',
      cmd: 'docker container prune -f',
      safety: 'safe',
      safetyText: 'Safe — running deployments are unaffected.',
    },
    {
      key: 'images',
      icon: Layers,
      title: 'Remove unused images',
      desc: 'Deletes every image not referenced by a container. Equivalent to docker image prune -a.',
      cmd: 'docker image prune -a -f',
      safety: 'caution',
      safetyText: 'Caution — next deploy of an old project may have to rebuild from scratch.',
    },
    {
      key: 'system',
      icon: Database,
      title: 'Full system prune',
      desc: 'Removes stopped containers + unused images + unused networks. Frees the most disk.',
      cmd: 'docker system prune -a -f',
      safety: 'warning',
      safetyText: 'Warning — broadest cleanup. Use only when disk is full.',
    },
  ];

  const safetyColor = (s: string) =>
    s === 'safe' ? 'text-emerald-400' : s === 'caution' ? 'text-amber-400' : 'text-red-400';
  const safetyBg = (s: string) =>
    s === 'safe' ? 'bg-emerald-500/10 border-emerald-500/20' :
    s === 'caution' ? 'bg-amber-500/10 border-amber-500/20' :
    'bg-red-500/10 border-red-500/20';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-blue-500/10 p-2">
          <HardDrive className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-200">Docker Maintenance</h3>
          <p className="text-xs text-slate-500">Reclaim disk space used by old containers, images, and build cache.</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it) => {
          const Icon = it.icon;
          const isBusy = busy === it.key;
          const isConfirm = confirm === it.key;
          return (
            <div key={it.key} className={`rounded-xl border ${safetyBg(it.safety)} p-4`}>
              <div className="flex items-start gap-3">
                <Icon className={`h-4 w-4 mt-0.5 ${safetyColor(it.safety)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{it.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{it.desc}</p>
                  <p className={`text-xs mt-1 ${safetyColor(it.safety)}`}>{it.safetyText}</p>
                  <code className="text-[11px] text-slate-500 font-mono block mt-2">$ {it.cmd}</code>
                </div>
                <div className="shrink-0">
                  {isConfirm ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirm(null)}
                        disabled={isBusy}
                      >Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => run(it.key)}
                        disabled={isBusy}
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirm(it.key)}
                      disabled={!!busy}
                    >Run</Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {result && (
        <div className={`mt-4 rounded-lg p-3 flex items-start gap-2 ${
          result.kind === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
        }`}>
          {result.kind === 'ok'
            ? <Check className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
          <p className={`text-xs ${result.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>
            {result.message}
          </p>
        </div>
      )}
    </div>
  );
}
