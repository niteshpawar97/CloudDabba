import { useCallback, useEffect, useState } from 'react';
import { Activity, Cpu, MemoryStick, ArrowDownUp, Save, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { getProjectMetrics, updateProjectLimits, ProjectMetrics } from '../../api/projects';
import { fmtBytes } from '../../utils/format';

const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0', fontSize: 12 };

function MiniChart({ data, dataKey, color, format }: { data: any[]; dataKey: string; color: string; format: (v: number) => string }) {
  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis dataKey="t" hide />
          <YAxis hide domain={[0, 'auto']} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(t) => new Date(t as number).toLocaleTimeString()}
            formatter={(v) => [format(Number(v)), '']}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub, warn }: { icon: any; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className={`text-lg font-semibold mt-1 ${warn ? 'text-amber-400' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function ResourcesCard({ projectId, isRunning }: { projectId: string; isRunning: boolean }) {
  const [m, setM] = useState<ProjectMetrics | null>(null);
  const [mem, setMem] = useState('');
  const [cpu, setCpu] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getProjectMetrics(projectId);
      setM(data);
      setMem((v) => v || String(data.limits.memoryMb));
      setCpu((v) => v || String(data.limits.cpu));
    } catch { /* card is optional — stay hidden on error */ }
  }, [projectId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (!m) return null;

  const cur = m.current;
  const limitBytes = m.limits.memoryMb * 1024 * 1024;
  const memPct = cur ? (cur.memUsage / limitBytes) * 100 : 0;
  const cpuPct = cur ? (cur.cpu / (m.limits.cpu * 100)) * 100 : 0;
  const dirty = Number(mem) !== m.limits.memoryMb || Number(cpu) !== m.limits.cpu;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await updateProjectLimits(projectId, Number(mem), Number(cpu));
      setMsg({ ok: true, text: res.message });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.message || 'Failed to save limits' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-500/10"><Activity className="h-5 w-5 text-blue-400" /></div>
        <div>
          <div className="text-sm font-semibold text-white">Resources</div>
          <div className="text-xs text-slate-500">Live usage, last hour (sampled every {m.intervalSec}s)</div>
        </div>
      </div>

      {!cur ? (
        <p className="text-sm text-slate-500 mb-4">
          {isRunning ? 'Collecting first samples… check back in a minute.' : 'No data — the project is not running.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Tile icon={Cpu} label="CPU" value={`${cur.cpu.toFixed(1)}%`}
              sub={`limit ${m.limits.cpu} core${m.limits.cpu === 1 ? '' : 's'}`} warn={cpuPct > 90} />
            <Tile icon={MemoryStick} label="Memory" value={fmtBytes(cur.memUsage)}
              sub={`${memPct.toFixed(0)}% of ${m.limits.memoryMb} MB`} warn={memPct > 90} />
            <Tile icon={ArrowDownUp} label="Network in" value={`${fmtBytes(cur.netRxRate)}/s`} />
            <Tile icon={ArrowDownUp} label="Network out" value={`${fmtBytes(cur.netTxRate)}/s`} />
          </div>
          {memPct > 90 && (
            <p className="text-xs text-amber-400 mb-3">
              Memory is close to the limit — the app may be killed (out of memory). Consider raising the limit below.
            </p>
          )}
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <div><p className="text-xs text-slate-500 mb-1">CPU %</p>
              <MiniChart data={m.history} dataKey="cpu" color="#3b82f6" format={(v) => `${v.toFixed(1)}%`} /></div>
            <div><p className="text-xs text-slate-500 mb-1">Memory</p>
              <MiniChart data={m.history} dataKey="memUsage" color="#a855f7" format={fmtBytes} /></div>
            <div><p className="text-xs text-slate-500 mb-1">Network in</p>
              <MiniChart data={m.history} dataKey="netRxRate" color="#22c55e" format={(v) => `${fmtBytes(v)}/s`} /></div>
          </div>
        </>
      )}

      <div className="border-t border-white/[0.06] pt-4">
        <p className="text-xs font-medium text-slate-300 mb-2">Resource limits</p>
        {m.limits.editable ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-400">
              Memory (MB)
              <input
                type="number" min={m.limits.minMemoryMb} max={m.limits.maxMemoryMb} step={64}
                value={mem} onChange={(e) => setMem(e.target.value)}
                className="mt-1 block w-32 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              CPU (cores)
              <input
                type="number" min={m.limits.minCpu} max={m.limits.maxCpu} step={0.25}
                value={cpu} onChange={(e) => setCpu(e.target.value)}
                className="mt-1 block w-28 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white"
              />
            </label>
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="flex items-center gap-1.5"><Save className="h-3.5 w-3.5" />Save</span>}
            </Button>
            <p className="text-xs text-slate-500 basis-full">
              Memory {m.limits.minMemoryMb}–{m.limits.maxMemoryMb} MB, CPU {m.limits.minCpu}–{m.limits.maxCpu}. Applied immediately to the running container and kept for future deploys.
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Docker Compose projects set their limits in docker-compose.yml.</p>
        )}
        {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>
    </Card>
  );
}
