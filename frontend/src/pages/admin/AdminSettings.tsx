import { useState, useEffect } from 'react';
import { getSettings } from '../../api/admin';
import { Spinner } from '../../components/ui/Spinner';
import { Settings, Globe, Server, Shield, Terminal } from 'lucide-react';

function SettingRow({ icon: Icon, label, value, color = 'text-slate-300' }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-slate-500" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <span className={`text-sm font-mono ${color}`}>{value}</span>
    </div>
  );
}

export function AdminSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Platform Settings</h1>

      <div className="max-w-2xl space-y-6">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" /> General
          </h2>
          <SettingRow icon={Globe} label="Base Domain" value={settings?.domain || '—'} color="text-blue-400" />
          <SettingRow icon={Server} label="Port" value={settings?.port?.toString() || '—'} />
          <SettingRow icon={Shield} label="Environment" value={settings?.environment || '—'} color={settings?.environment === 'production' ? 'text-green-400' : 'text-amber-400'} />
          <SettingRow icon={Terminal} label="Container Port Range" value={settings?.portRange || '—'} />
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" /> CORS Origins
          </h2>
          <div className="space-y-2">
            {settings?.corsOrigin?.map((origin: string, i: number) => (
              <div key={i} className="px-3 py-2 rounded bg-white/[0.03] text-sm font-mono text-slate-300">
                {origin}
              </div>
            )) || <p className="text-slate-500 text-sm">No CORS origins configured</p>}
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber-400 mb-2">Configuration</h2>
          <p className="text-sm text-slate-400">
            Platform settings are configured via the <code className="bg-white/5 px-2 py-0.5 rounded text-blue-400">.env</code> file on the server.
            Changes require a restart: <code className="bg-white/5 px-2 py-0.5 rounded text-blue-400">pm2 restart clouddabba-api</code>
          </p>
        </div>
      </div>
    </div>
  );
}
