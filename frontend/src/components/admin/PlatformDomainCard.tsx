import { useState, useEffect } from 'react';
import { getServerInfo, testDns, getSslStatus, getPortRangeStatus, changeDomain, installSsl, DnsTestResult, SslStatus, PortRangeStatus, ServerInfo, DomainChangeResult } from '../../api/admin';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { Globe, Shield, Server, Check, X, Copy, AlertTriangle, Play, Lock, ArrowRightCircle, ExternalLink, Download } from 'lucide-react';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-3 bg-[#0a0e14] rounded-lg px-3 py-2 font-mono text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-slate-500 text-xs uppercase shrink-0">{label}</span>
        <span className="text-slate-200 truncate">{value || '—'}</span>
      </div>
      <button onClick={copy} className="text-slate-400 hover:text-white shrink-0">
        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Status({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  const color = ok === null ? 'text-slate-500' : ok ? 'text-green-400' : 'text-red-400';
  const Icon = ok === null ? AlertTriangle : ok ? Check : X;
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
      <div>
        <p className={`text-sm font-medium ${color}`}>{label}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

const PROVIDER_GUIDES: Record<string, { name: string; steps: string[] }> = {
  cloudflare: {
    name: 'Cloudflare',
    steps: [
      'Dashboard → Domain → DNS → Records → Add record',
      'Type: A, Name: @, IPv4: <server IP>, Proxy: DNS only (grey cloud)',
      'Type: A, Name: *, IPv4: <server IP>, Proxy: DNS only (grey cloud)',
      'Wait 1–2 minutes for propagation',
    ],
  },
  godaddy: {
    name: 'GoDaddy',
    steps: [
      'My Products → Domain → DNS → Manage DNS',
      'Add: Type A, Host @, Points to <server IP>, TTL 600',
      'Add: Type A, Host *, Points to <server IP>, TTL 600',
    ],
  },
  namecheap: {
    name: 'Namecheap',
    steps: [
      'Domain List → Manage → Advanced DNS',
      'Add New Record: A Record, Host @, Value <server IP>, TTL Automatic',
      'Add New Record: A Record, Host *, Value <server IP>, TTL Automatic',
    ],
  },
  route53: {
    name: 'AWS Route 53',
    steps: [
      'Hosted zones → your domain → Create record',
      'Record name: (leave blank), Type: A, Value: <server IP>',
      'Record name: *, Type: A, Value: <server IP>',
    ],
  },
};

export function PlatformDomainCard({ domain }: { domain: string }) {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [dnsResult, setDnsResult] = useState<DnsTestResult | null>(null);
  const [ssl, setSsl] = useState<SslStatus | null>(null);
  const [ports, setPorts] = useState<PortRangeStatus | null>(null);

  const [testingDns, setTestingDns] = useState(false);
  const [checkingSsl, setCheckingSsl] = useState(false);
  const [checkingPorts, setCheckingPorts] = useState(false);
  const [guideOpen, setGuideOpen] = useState<string | null>(null);

  const [switchOpen, setSwitchOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newSslEmail, setNewSslEmail] = useState('');
  const [skipDns, setSkipDns] = useState(false);
  const [skipSsl, setSkipSsl] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchResult, setSwitchResult] = useState<DomainChangeResult | null>(null);

  const [sslOpen, setSslOpen] = useState(false);
  const [sslEmail, setSslEmail] = useState('');
  const [includeWww, setIncludeWww] = useState(true);
  const [sslInstalling, setSslInstalling] = useState(false);
  const [sslResult, setSslResult] = useState<DomainChangeResult | null>(null);

  const runInstallSsl = async () => {
    setSslInstalling(true);
    setSslResult(null);
    try {
      const r = await installSsl({ domain, email: sslEmail || undefined, includeWww });
      setSslResult(r);
      if (r.ok) setSsl(await getSslStatus(domain));
    } catch (e: any) {
      setSslResult({ ok: false, steps: [], domain, error: e.response?.data?.message || e.message || 'Request failed' });
    } finally {
      setSslInstalling(false);
    }
  };

  const runSwitch = async () => {
    setSwitching(true);
    setSwitchResult(null);
    try {
      const r = await changeDomain({ domain: newDomain, sslEmail: newSslEmail || undefined, skipDns, skipSsl });
      setSwitchResult(r);
    } catch (e: any) {
      setSwitchResult({
        ok: false,
        steps: [],
        domain: newDomain,
        error: e.response?.data?.message || e.message || 'Request failed',
      });
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    getServerInfo().then(setInfo).catch(() => {});
  }, []);

  const runDns = async () => {
    setTestingDns(true);
    try {
      setDnsResult(await testDns(domain));
    } finally {
      setTestingDns(false);
    }
  };

  const runSsl = async () => {
    setCheckingSsl(true);
    try {
      setSsl(await getSslStatus(domain));
    } finally {
      setCheckingSsl(false);
    }
  };

  const runPorts = async () => {
    setCheckingPorts(true);
    try {
      setPorts(await getPortRangeStatus());
    } finally {
      setCheckingPorts(false);
    }
  };

  const canTest = domain && domain !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(domain);

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-400" /> Platform Domain & SSL
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure a custom domain (e.g. <code className="text-blue-400">clouddabba.dev</code>) and verify DNS + SSL are working.
          </p>
        </div>
        <button
          onClick={() => { setNewDomain(domain || ''); setSwitchOpen(true); setSwitchResult(null); }}
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors"
        >
          <ArrowRightCircle className="h-4 w-4" /> Change Domain
        </button>
      </div>

      {/* Server identity */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your Server</p>
        <CopyRow label="Public IP" value={info?.ip || 'detecting...'} />
        <CopyRow label="Panel URL" value={info ? `http://${info.ip}:${info.panelPort}` : ''} />
      </div>

      {/* DNS records to add */}
      {canTest && info?.ip && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">DNS Records to Add at Your Registrar</p>
          <CopyRow label="A   @" value={info.ip} />
          <CopyRow label="A   *" value={info.ip} />
          <p className="text-xs text-slate-500">
            Both records point the apex (<code className="text-blue-400">{domain}</code>) and wildcard (<code className="text-blue-400">*.{domain}</code>) to your server so deployed apps get subdomains automatically.
          </p>
        </div>
      )}

      {/* Provider guides */}
      {canTest && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Provider Guides</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PROVIDER_GUIDES).map(([key, p]) => (
              <button
                key={key}
                onClick={() => setGuideOpen(guideOpen === key ? null : key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  guideOpen === key ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:border-white/[0.15]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          {guideOpen && (
            <div className="mt-3 bg-[#0a0e14] border border-white/[0.06] rounded-lg p-4">
              <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
                {PROVIDER_GUIDES[guideOpen].steps.map((s, i) => (
                  <li key={i} className="leading-relaxed">{s.replace('<server IP>', info?.ip || 'YOUR_IP')}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* DNS Test */}
      <div className="border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-white">DNS Verification</p>
            <p className="text-xs text-slate-500">
              Resolves <code className="text-blue-400">{domain || '(domain)'}</code> and a throwaway subdomain, then compares the answers to this server's public IP.
              Apex must match for the panel to load on your domain; wildcard must match for deployed apps to get subdomains automatically.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={runDns} loading={testingDns} disabled={!canTest}>
            <span className="flex items-center gap-2"><Play className="h-3.5 w-3.5" /> Test DNS</span>
          </Button>
        </div>
        {dnsResult && (
          <div className="bg-[#0a0e14] rounded-lg p-3 space-y-2.5 text-sm">
            {dnsResult.error ? (
              <Status ok={false} label={dnsResult.error} />
            ) : (
              <>
                <Status
                  ok={dnsResult.apex?.matches ?? null}
                  label={`Apex ${dnsResult.domain}`}
                  detail={
                    dnsResult.apex?.error
                      ? `Lookup failed: ${dnsResult.apex.error}`
                      : dnsResult.apex?.resolved?.length
                        ? `Resolved to ${dnsResult.apex.resolved.join(', ')} ${dnsResult.apex.matches ? '✓' : `≠ ${dnsResult.serverIp}`}`
                        : 'No A record found'
                  }
                />
                <Status
                  ok={dnsResult.wildcard?.matches ?? null}
                  label={`Wildcard *.${dnsResult.domain}`}
                  detail={
                    dnsResult.wildcard?.error
                      ? `Lookup failed: ${dnsResult.wildcard.error}`
                      : dnsResult.wildcard?.resolved?.length
                        ? `Resolved to ${dnsResult.wildcard.resolved.join(', ')} ${dnsResult.wildcard.matches ? '✓' : `≠ ${dnsResult.serverIp}`}`
                        : 'No wildcard A record — deployed apps will not get subdomains'
                  }
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* SSL Status */}
      <div className="border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-400" /> SSL Certificate
            </p>
            <p className="text-xs text-slate-500">
              Reads <code className="text-blue-400">/etc/letsencrypt/live/</code> on the server and shows every installed cert — issuer, expiry, days remaining, domains covered.
              Use <strong className="text-slate-300">Install SSL</strong> to run certbot for the current base domain directly from the panel.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={runSsl} loading={checkingSsl}>
              <span className="flex items-center gap-2"><Play className="h-3.5 w-3.5" /> Check</span>
            </Button>
            <Button
              size="sm"
              onClick={() => { setSslEmail(''); setIncludeWww(true); setSslOpen(true); setSslResult(null); }}
              disabled={!canTest}
            >
              <span className="flex items-center gap-2"><Download className="h-3.5 w-3.5" /> Install SSL</span>
            </Button>
          </div>
        </div>
        {ssl && (
          <div className="bg-[#0a0e14] rounded-lg p-3 space-y-3 text-sm">
            {!ssl.installed ? (
              <>
                <Status ok={false} label="No SSL certificate installed" detail="HTTP only — click Install SSL above to issue one via Let's Encrypt." />
                <details className="bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2.5">
                  <summary className="text-xs text-amber-400 cursor-pointer">Or run manually on the server</summary>
                  <code className="block mt-2 text-xs text-amber-200 font-mono break-all">
                    sudo certbot --nginx -d {domain || 'yourdomain.com'} --email you@email.com --agree-tos --non-interactive --redirect
                  </code>
                  <p className="text-xs text-slate-500 mt-2">Wildcard requires DNS-01 challenge (different flow) — see Certbot docs.</p>
                </details>
              </>
            ) : (
              (ssl.certs || []).map((c) => (
                <div key={c.name} className="space-y-1.5 border-l-2 border-green-500/40 pl-3">
                  <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-green-400" /> {c.subject || c.name}
                  </p>
                  {c.error ? (
                    <p className="text-xs text-red-400">{c.error}</p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">Issuer: <span className="text-slate-300">{c.issuer}</span></p>
                      <p className="text-xs text-slate-500">
                        Expires: <span className={`${(c.daysLeft ?? 0) < 14 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                        </span>
                        {c.daysLeft != null && <span className="ml-2 text-slate-500">({c.daysLeft} days left)</span>}
                      </p>
                      <p className="text-xs text-slate-500">Wildcard: <span className={c.wildcardCovered ? 'text-green-400' : 'text-amber-400'}>{c.wildcardCovered ? 'Covered ✓' : 'Not covered'}</span></p>
                      {c.sans && c.sans.length > 0 && (
                        <p className="text-xs text-slate-500">Domains: <span className="text-slate-300">{c.sans.join(', ')}</span></p>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Port range */}
      <div className="border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-400" /> Container Port Range
            </p>
            <p className="text-xs text-slate-500">
              Every deployed app binds to one port in this range. Uses <code className="text-blue-400">ss -tln</code> for the in-use count, then runs a live kernel bind test on the first five ports to confirm they're actually free (ports can be "not listed" but still reserved by something).
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={runPorts} loading={checkingPorts}>
            <span className="flex items-center gap-2"><Play className="h-3.5 w-3.5" /> Test Ports</span>
          </Button>
        </div>
        {ports && (
          <div className="bg-[#0a0e14] rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Range</span>
              <span className="text-slate-200 font-mono">{ports.start}–{ports.end}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total</span>
              <span className="text-slate-200 font-mono">{ports.total}</span>
            </div>
            {ports.used >= 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">In use</span>
                  <span className="text-amber-400 font-mono">{ports.used}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Free</span>
                  <span className="text-green-400 font-mono">{ports.free}</span>
                </div>
              </>
            )}
            {ports.used < 0 && (
              <p className="text-xs text-amber-400">Unable to query netstat — install <code>ss</code> or run as privileged user for accurate counts.</p>
            )}
            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-xs text-slate-500 mb-1.5">Kernel-level bind test (first 5 ports):</p>
              <div className="grid grid-cols-5 gap-2">
                {ports.kernelAvailable.map((p) => (
                  <div key={p.port} className={`text-xs font-mono text-center py-1 rounded ${p.free ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {p.port} {p.free ? '✓' : '✗'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Domain modal */}
      {switchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0e14] border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {!switchResult ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <ArrowRightCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Change Platform Domain</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  This will update the database, regenerate the NGINX config for the CloudDabba panel, reload NGINX, and issue an SSL certificate via Let's Encrypt.
                </p>

                <div className="space-y-3 mb-4">
                  <Input
                    label="New Domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="clouddabba.dev"
                    disabled={switching}
                  />
                  <Input
                    label="SSL Email (for Let's Encrypt)"
                    type="email"
                    value={newSslEmail}
                    onChange={(e) => setNewSslEmail(e.target.value)}
                    placeholder="you@email.com"
                    disabled={switching}
                  />
                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={skipDns} onChange={(e) => setSkipDns(e.target.checked)} disabled={switching} />
                      Skip DNS verification (advanced — use if DNS is still propagating)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={skipSsl} onChange={(e) => setSkipSsl(e.target.checked)} disabled={switching} />
                      Skip SSL issuance (stay on HTTP)
                    </label>
                  </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4">
                  <p className="text-xs text-amber-400">
                    <strong>Note:</strong> Only apex + specific subdomains get SSL via HTTP-01. Wildcard certificate requires DNS-01 challenge with a provider plugin (not automated here).
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setSwitchOpen(false)} disabled={switching}>Cancel</Button>
                  <Button onClick={runSwitch} loading={switching} disabled={!newDomain}>
                    <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Start</span>
                  </Button>
                </div>

                {switching && (
                  <div className="mt-4 text-center">
                    <Spinner size="md" />
                    <p className="text-xs text-slate-500 mt-2">Running... this can take 30–60 seconds for SSL issuance.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${switchResult.ok ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {switchResult.ok ? <Check className="h-5 w-5 text-green-400" /> : <X className="h-5 w-5 text-red-400" />}
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {switchResult.ok ? 'Domain Changed' : 'Domain Change Failed'}
                  </h3>
                </div>

                <div className="space-y-2 mb-4">
                  {switchResult.steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 bg-[#0f1218] rounded-lg px-3 py-2">
                      {s.skipped ? (
                        <AlertTriangle className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                      ) : s.ok ? (
                        <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${s.skipped ? 'text-slate-400' : s.ok ? 'text-green-400' : 'text-red-400'}`}>
                          {s.name}{s.skipped ? ' (skipped)' : ''}
                        </p>
                        {s.detail && <pre className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap break-words font-sans">{s.detail}</pre>}
                      </div>
                    </div>
                  ))}
                </div>

                {switchResult.error && !switchResult.ok && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
                    <p className="text-sm text-red-400">{switchResult.error}</p>
                  </div>
                )}

                {switchResult.ok && switchResult.panelUrl && (
                  <a
                    href={switchResult.panelUrl}
                    className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5 mb-4 text-sm text-green-400 hover:bg-green-500/20 transition"
                  >
                    <ExternalLink className="h-4 w-4" /> Open {switchResult.panelUrl}
                  </a>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => { setSwitchResult(null); setSwitching(false); }}>Run Again</Button>
                  <Button onClick={() => { setSwitchOpen(false); setSwitchResult(null); if (switchResult.ok) setTimeout(() => window.location.reload(), 200); }}>
                    {switchResult.ok ? 'Reload Page' : 'Close'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Install SSL modal */}
      {sslOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0e14] border border-white/[0.08] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {!sslResult ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Shield className="h-5 w-5 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Install SSL Certificate</h3>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Runs <code className="text-blue-400">certbot --nginx</code> for <strong className="text-slate-300">{domain}</strong> and configures NGINX to redirect HTTP → HTTPS automatically.
                </p>

                <div className="space-y-3 mb-4">
                  <Input
                    label="Email (for Let's Encrypt)"
                    type="email"
                    value={sslEmail}
                    onChange={(e) => setSslEmail(e.target.value)}
                    placeholder="Leave blank to use SSL Email / Admin Email from settings"
                    disabled={sslInstalling}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={includeWww} onChange={(e) => setIncludeWww(e.target.checked)} disabled={sslInstalling} />
                    Also cover <code className="text-blue-400">www.{domain}</code>
                  </label>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4 space-y-1.5">
                  <p className="text-xs text-amber-400"><strong>Pre-requisites:</strong></p>
                  <ul className="text-xs text-amber-300/80 list-disc list-inside space-y-0.5">
                    <li>DNS A record for <code>{domain}</code> must point to this server</li>
                    <li>Port 80 must be open in cloud firewall (certbot challenges it)</li>
                    <li>NGINX must be running</li>
                    <li>Wildcard cert (<code>*.{domain}</code>) is <strong>not</strong> handled — needs DNS-01</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setSslOpen(false)} disabled={sslInstalling}>Cancel</Button>
                  <Button onClick={runInstallSsl} loading={sslInstalling}>
                    <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Install Now</span>
                  </Button>
                </div>

                {sslInstalling && (
                  <div className="mt-4 text-center">
                    <Spinner size="md" />
                    <p className="text-xs text-slate-500 mt-2">Running certbot... can take 20–60 seconds.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${sslResult.ok ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {sslResult.ok ? <Check className="h-5 w-5 text-green-400" /> : <X className="h-5 w-5 text-red-400" />}
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {sslResult.ok ? 'SSL Installed' : 'SSL Installation Failed'}
                  </h3>
                </div>

                <div className="space-y-2 mb-4">
                  {sslResult.steps.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 bg-[#0f1218] rounded-lg px-3 py-2">
                      {s.ok ? <Check className="h-4 w-4 text-green-400 mt-0.5 shrink-0" /> : <X className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${s.ok ? 'text-green-400' : 'text-red-400'}`}>{s.name}</p>
                        {s.detail && <pre className="text-xs text-slate-500 mt-0.5 whitespace-pre-wrap break-words font-sans">{s.detail}</pre>}
                      </div>
                    </div>
                  ))}
                </div>

                {sslResult.error && !sslResult.ok && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
                    <p className="text-sm text-red-400">{sslResult.error}</p>
                  </div>
                )}

                {sslResult.ok && sslResult.panelUrl && (
                  <a
                    href={sslResult.panelUrl}
                    className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5 mb-4 text-sm text-green-400 hover:bg-green-500/20 transition"
                  >
                    <ExternalLink className="h-4 w-4" /> Open {sslResult.panelUrl}
                  </a>
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => { setSslResult(null); setSslInstalling(false); }}>Try Again</Button>
                  <Button onClick={() => { setSslOpen(false); setSslResult(null); }}>Close</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
