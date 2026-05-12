import { useState, useEffect } from 'react';
import { getSettings, updateSettings, restartServer, PlatformSettingsResponse } from '../../api/admin';
import { Spinner } from '../../components/ui/Spinner';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Settings, Globe, Server, Shield, Terminal, Save, Mail, GitBranch, Users, Check, AlertCircle, RotateCw, Power } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';
import { PlatformDomainCard } from '../../components/admin/PlatformDomainCard';
import { CloudFirewallGuideCard } from '../../components/admin/CloudFirewallGuideCard';
import { DockerMaintenanceCard } from '../../components/admin/DockerMaintenanceCard';

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-white/10'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform m-0.5 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function InfraRow({ icon: Icon, label, value, desc, color = 'text-slate-300' }: { icon: any; label: string; value: string; desc?: string; color?: string }) {
  return (
    <div className="py-2.5 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-400">{label}</span>
        </div>
        <span className={`text-sm font-mono ${color}`}>{value}</span>
      </div>
      {desc && <p className="text-xs text-slate-500 mt-1 pl-7 pr-0">{desc}</p>}
    </div>
  );
}

export function AdminSettings() {
  usePageTitle('Admin - Settings');
  const [data, setData] = useState<PlatformSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const [form, setForm] = useState({
    platformName: '',
    baseDomain: '',
    adminEmail: '',
    sslEmail: '',
    corsOrigins: '',
    allowSignup: true,
    defaultBranch: 'main',
  });

  const [restartOpen, setRestartOpen] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartStatus, setRestartStatus] = useState<string>('');

  const doRestart = async () => {
    setRestarting(true);
    setRestartStatus('Sending restart signal...');
    try {
      await restartServer();
      setRestartStatus('Server is restarting. Waiting for it to come back online...');

      const deadline = Date.now() + 60_000;
      const poll = async () => {
        try {
          const r = await fetch('/api/v1/health', { cache: 'no-store' });
          if (r.ok) {
            setRestartStatus('Back online. Reloading...');
            setTimeout(() => window.location.reload(), 500);
            return;
          }
        } catch {}
        if (Date.now() < deadline) {
          setTimeout(poll, 2000);
        } else {
          setRestartStatus('Timed out waiting for server. Please reload manually.');
        }
      };
      setTimeout(poll, 3000);
    } catch (e: any) {
      setRestartStatus(e.response?.data?.message || 'Restart failed');
      setTimeout(() => { setRestarting(false); setRestartOpen(false); setRestartStatus(''); }, 3000);
    }
  };

  useEffect(() => {
    getSettings()
      .then((d) => {
        setData(d);
        setForm(d.editable);
      })
      .catch(() => setToast({ kind: 'err', msg: 'Failed to load settings' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      await updateSettings(form);
      setToast({ kind: 'ok', msg: 'Settings saved' });
      const fresh = await getSettings();
      setData(fresh);
      setForm(fresh.editable);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e.response?.data?.message || 'Save failed' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) return <Spinner size="lg" />;

  const dirty = data && JSON.stringify(form) !== JSON.stringify(data.editable);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
          {dirty && <span className="text-xs text-amber-400">● Unsaved changes</span>}
        </div>
        <button
          onClick={() => setRestartOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <RotateCw className="h-4 w-4" /> Restart Server
        </button>
      </div>

      {toast && (
        <div className={`mb-6 max-w-2xl flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
          toast.kind === 'ok' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {toast.kind === 'ok' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* Editable: Platform */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" /> General
          </h2>
          <p className="text-xs text-slate-500 mb-4">Platform identity and account defaults. Stored in DB — changes apply within 30 seconds, no restart needed.</p>
          <div className="space-y-5">
            <div>
              <Input label="Platform Name" value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} placeholder="CloudDabba" />
              <p className="text-xs text-slate-500 mt-1.5">Shown in browser tab, setup wizard header, and system emails. Pure branding — no technical effect.</p>
            </div>
            <div>
              <Input label="Base Domain" value={form.baseDomain} onChange={(e) => setForm({ ...form, baseDomain: e.target.value })} placeholder="clouddabba.yourdomain.com" />
              <p className="text-xs text-slate-500 mt-1.5">
                The main domain CloudDabba runs on. Used for the admin panel AND auto-generated subdomains for deployed apps (<code className="text-blue-400">myapp.yourdomain.com</code>).
                To switch domain end-to-end (NGINX + SSL), use <strong className="text-slate-300">Change Domain</strong> in the Platform Domain card below — editing this field alone only updates the DB.
              </p>
            </div>
            <div>
              <Input label="Admin Email" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="you@email.com" />
              <p className="text-xs text-slate-500 mt-1.5">Primary contact email for the platform — used for login, system notifications, and fallback SSL renewal reminders.</p>
            </div>
            <div>
              <Input label="SSL / Let's Encrypt Email" type="email" value={form.sslEmail} onChange={(e) => setForm({ ...form, sslEmail: e.target.value })} placeholder="ssl@yourdomain.com" />
              <p className="text-xs text-slate-500 mt-1.5">Sent to Let's Encrypt when issuing certificates; they email you before a cert is about to expire. Leave empty to use Admin Email.</p>
            </div>
            <div>
              <Input label="Default Git Branch" value={form.defaultBranch} onChange={(e) => setForm({ ...form, defaultBranch: e.target.value })} placeholder="main" />
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                <GitBranch className="h-3 w-3" /> Pre-filled when users create new projects. Change to <code className="text-blue-400">master</code> if your org still uses that as the default.
              </p>
            </div>
          </div>
        </div>

        {/* Editable: Access */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" /> Access Control
          </h2>
          <p className="text-xs text-slate-500 mb-2">Who can create an account on this CloudDabba instance.</p>
          <Toggle
            checked={form.allowSignup}
            onChange={(v) => setForm({ ...form, allowSignup: v })}
            label="Allow User Signup"
            desc="ON: anyone can register at /signup (team/public deployments). OFF: only the admin can invite users — the /signup endpoint returns 403 (private/single-tenant deployments). The very first user is always allowed through so you can never lock yourself out."
          />
        </div>

        {/* Editable: CORS */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-400" /> CORS Origins
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Browsers block cross-origin API calls unless the server explicitly allows the calling origin. List every URL that should be allowed to hit the CloudDabba API — comma-separated, with scheme and port. Examples: <code className="text-blue-400">https://clouddabba.dev, https://app.clouddabba.dev, http://localhost:5173</code>.
            Leave blank to fall back to the <code className="text-blue-400">.env</code> <code className="text-blue-400">CORS_ORIGIN</code> value. Applies per-request — no restart needed.
          </p>
          <textarea
            value={form.corsOrigins}
            onChange={(e) => setForm({ ...form, corsOrigins: e.target.value })}
            placeholder="https://clouddabba.com, https://app.clouddabba.com"
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl text-slate-200 placeholder-slate-500 bg-[#0f1218] border border-white/[0.06] font-mono text-sm focus:outline-none focus:border-blue-500/40"
          />
        </div>

        {/* Platform Domain + SSL + Port Range diagnostics */}
        <PlatformDomainCard domain={form.baseDomain} />

        {/* Cloud provider firewall guide */}
        <CloudFirewallGuideCard />

        {/* Docker disk maintenance — prune stopped containers / unused images / system */}
        <DockerMaintenanceCard />

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3 sticky bottom-4 z-10">
          <Button
            variant="secondary"
            onClick={() => data && setForm(data.editable)}
            disabled={!dirty || saving}
          >
            Discard
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Save Changes</span>
          </Button>
        </div>

        {/* Restart modal + overlay */}
        {restartOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#0a0e14] border border-white/[0.08] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              {!restarting ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <Power className="h-5 w-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Restart Server?</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">
                    The backend API (<code className="text-blue-400">clouddabba-api</code>) will restart via PM2.
                    All connected admin sessions and deployment webhooks will briefly disconnect (~5–10 seconds).
                  </p>
                  <p className="text-sm text-slate-400 mb-6">
                    Use this after changing <code className="text-blue-400">.env</code> infrastructure values (Port, Port Range, secrets).
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setRestartOpen(false)}>Cancel</Button>
                    <Button onClick={doRestart} className="!bg-red-500 hover:!bg-red-600">
                      <span className="flex items-center gap-2"><RotateCw className="h-4 w-4" /> Restart Now</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <Spinner size="lg" />
                  <p className="text-slate-300 mt-4 font-medium">Restarting...</p>
                  <p className="text-sm text-slate-500 mt-2">{restartStatus}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Read-only: Infrastructure */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Server className="h-5 w-5 text-amber-400" /> Infrastructure
          </h2>
          <p className="text-xs text-slate-500 mb-4">Configured in <code className="text-blue-400">.env</code> — restart required to change.</p>
          <InfraRow
            icon={Terminal}
            label="API Port"
            value={data?.infrastructure.port?.toString() || '—'}
            desc="Internal port the backend listens on. NGINX proxies requests from 80/443 here. Change via PORT in .env."
          />
          <InfraRow
            icon={Shield}
            label="Environment"
            value={data?.infrastructure.environment || '—'}
            color={data?.infrastructure.environment === 'production' ? 'text-green-400' : 'text-amber-400'}
            desc="production = minified builds, concise logs, strict error handling. development = verbose logs + stack traces. Change via NODE_ENV in .env."
          />
          <InfraRow
            icon={Globe}
            label="Container Port Range"
            value={data?.infrastructure.portRange || '—'}
            desc="Each deployed app gets one port from this range. A larger range = more apps. Must also be opened in UFW and cloud firewall. Change via PORT_RANGE_START / PORT_RANGE_END in .env."
          />
          <InfraRow
            icon={Mail}
            label="SSL Enabled"
            value={data?.sslEnabled ? 'Yes' : 'No'}
            color={data?.sslEnabled ? 'text-green-400' : 'text-slate-500'}
            desc="Whether a valid Let's Encrypt certificate is installed for Base Domain. Use Change Domain to set up SSL automatically."
          />
          {data?.installedAt && (
            <InfraRow
              icon={Server}
              label="Installed"
              value={new Date(data.installedAt).toLocaleString()}
              desc="When the setup wizard was first completed."
            />
          )}
        </div>
      </div>
    </div>
  );
}
