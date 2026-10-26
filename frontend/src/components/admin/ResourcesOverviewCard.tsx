import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { getResourceOverview, ResourceOverview } from '../../api/admin';
import { fmtBytes } from '../../utils/format';

export function ResourcesOverviewCard() {
  const [data, setData] = useState<ResourceOverview | null>(null);

  useEffect(() => {
    const load = () => getResourceOverview().then(setData).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!data) return null;
  const memPct = data.host.memTotal ? (data.host.memUsed / data.host.memTotal) * 100 : 0;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2"><Activity className="h-5 w-5 text-blue-400" /></div>
          <h2 className="text-lg font-semibold text-white">Resource Usage</h2>
        </div>
        <p className="text-xs text-slate-400">
          Host: load {data.host.load1.toFixed(2)} / {data.host.cpuCount} cores · RAM {fmtBytes(data.host.memUsed)} / {fmtBytes(data.host.memTotal)} ({memPct.toFixed(0)}%)
        </p>
      </div>
      {data.projects.length === 0 ? (
        <p className="text-sm text-slate-500">No running projects sampled yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2 pr-4 font-medium">Project</th>
                <th className="py-2 pr-4 font-medium">Owner</th>
                <th className="py-2 pr-4 font-medium">CPU</th>
                <th className="py-2 pr-4 font-medium">Memory</th>
                <th className="py-2 font-medium">Net in / out</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.slice(0, 10).map((p) => {
                const pct = p.memLimit ? (p.memUsage / p.memLimit) * 100 : 0;
                return (
                  <tr key={p.projectId} className="border-t border-white/[0.04]">
                    <td className="py-2 pr-4 text-white">{p.name}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">{p.owner}</td>
                    <td className="py-2 pr-4 text-slate-300">{p.cpu.toFixed(1)}%</td>
                    <td className={`py-2 pr-4 ${pct > 90 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {fmtBytes(p.memUsage)}{p.memLimit ? ` (${pct.toFixed(0)}%)` : ''}
                    </td>
                    <td className="py-2 text-slate-400 text-xs">{fmtBytes(p.netRxRate)}/s · {fmtBytes(p.netTxRate)}/s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
