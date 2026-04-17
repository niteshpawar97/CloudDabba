import { useState, useEffect } from 'react';
import { getServerInfo, testDns, getSslStatus, getPortRangeStatus, DnsTestResult, SslStatus, PortRangeStatus, ServerInfo } from '../../api/admin';
import { Button } from '../ui/Button';
import { Globe, Shield, Server, Check, X, Copy, AlertTriangle, Play, Lock } from 'lucide-react';

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
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-400" /> Platform Domain & SSL
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure a custom domain (e.g. <code className="text-blue-400">clouddabba.dev</code>) and verify DNS + SSL are working.
        </p>
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
            <p className="text-xs text-slate-500">Checks that <code className="text-blue-400">{domain || '(domain)'}</code> resolves to your server.</p>
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
            <p className="text-xs text-slate-500">Lets Encrypt cert installed on this server.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={runSsl} loading={checkingSsl}>
            <span className="flex items-center gap-2"><Play className="h-3.5 w-3.5" /> Check SSL</span>
          </Button>
        </div>
        {ssl && (
          <div className="bg-[#0a0e14] rounded-lg p-3 space-y-3 text-sm">
            {!ssl.installed ? (
              <>
                <Status ok={false} label="No SSL certificate installed" detail="HTTP only — set up SSL below." />
                <div className="bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Run on your server to install:</p>
                  <code className="block text-xs text-amber-200 font-mono break-all">
                    sudo certbot --nginx -d {domain || 'yourdomain.com'} -d *.{domain || 'yourdomain.com'} --email you@email.com --agree-tos --non-interactive
                  </code>
                  <p className="text-xs text-slate-500 mt-2">Wildcard requires DNS-01 challenge (different flow) — see Certbot docs.</p>
                </div>
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
            <p className="text-xs text-slate-500">Ports used for deployed app containers.</p>
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
    </div>
  );
}
