import { useState } from 'react';
import { Cloud, Copy, Check, ExternalLink, Shield } from 'lucide-react';

const PORTS: Array<{ port: string; proto: 'TCP'; desc: string; required: boolean }> = [
  { port: '80', proto: 'TCP', desc: 'HTTP (NGINX)', required: true },
  { port: '443', proto: 'TCP', desc: 'HTTPS (NGINX + SSL)', required: true },
  { port: '6050', proto: 'TCP', desc: 'CloudDabba panel (direct access before SSL)', required: true },
  { port: '10000-20000', proto: 'TCP', desc: 'Deployed app container port range', required: true },
  { port: '22', proto: 'TCP', desc: 'SSH (usually already open)', required: false },
];

type ProviderKey = 'aws' | 'oracle' | 'azure' | 'gcp' | 'digitalocean' | 'hetzner' | 'vultr' | 'linode';

const PROVIDERS: Record<ProviderKey, {
  name: string;
  panel: string;
  docs: string;
  steps: string[];
  note?: string;
}> = {
  aws: {
    name: 'AWS EC2',
    panel: 'EC2 → Instances → your instance → Security tab → Security groups',
    docs: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/working-with-security-groups.html',
    steps: [
      'Open EC2 Console → Instances → select your instance',
      'Bottom panel → Security tab → click the Security group link',
      'Click "Edit inbound rules" → "Add rule"',
      'Type: Custom TCP, Port: 6050, Source: 0.0.0.0/0 (or your IP for private), Description: CloudDabba panel',
      'Add rule: Custom TCP, Port range: 10000-20000, Source: 0.0.0.0/0, Description: Deployed apps',
      'Make sure 80 (HTTP) and 443 (HTTPS) rules also exist',
      'Save rules — takes effect immediately',
    ],
    note: 'Security group rules apply instantly, no instance restart required.',
  },
  oracle: {
    name: 'Oracle Cloud (OCI)',
    panel: 'Networking → Virtual Cloud Networks → your VCN → Security Lists',
    docs: 'https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/securitylists.htm',
    steps: [
      'Navigation menu → Networking → Virtual Cloud Networks',
      'Click your VCN → Security Lists → Default Security List',
      'Click "Add Ingress Rules"',
      'Stateless: No, Source Type: CIDR, Source CIDR: 0.0.0.0/0',
      'IP Protocol: TCP, Destination Port Range: 6050',
      'Add another: Destination Port Range: 10000-20000',
      'Save — rules apply within seconds',
    ],
    note: 'Oracle also has a host-level iptables rule you may need: sudo iptables -I INPUT -p tcp --dport 6050 -j ACCEPT && sudo netfilter-persistent save',
  },
  azure: {
    name: 'Azure (NSG)',
    panel: 'Virtual machines → your VM → Networking → Network security group',
    docs: 'https://docs.microsoft.com/en-us/azure/virtual-network/network-security-groups-overview',
    steps: [
      'Azure Portal → Virtual machines → your VM',
      'Left sidebar → Networking → click the NSG link',
      'Inbound security rules → Add',
      'Source: Any, Source port: *, Destination: Any, Service: Custom',
      'Destination port ranges: 6050, Protocol: TCP, Action: Allow, Priority: 1010',
      'Add another: Destination port ranges: 10000-20000, Priority: 1020',
      'Confirm — rules activate in about 30 seconds',
    ],
    note: 'Priority matters — lower number = higher priority. Use 1000-4096 range for custom rules.',
  },
  gcp: {
    name: 'Google Cloud (GCP)',
    panel: 'VPC network → Firewall',
    docs: 'https://cloud.google.com/vpc/docs/using-firewalls',
    steps: [
      'GCP Console → VPC network → Firewall',
      'Click "CREATE FIREWALL RULE"',
      'Name: clouddabba-panel, Direction: Ingress, Action: Allow',
      'Targets: All instances (or target tag of your VM)',
      'Source filter: IPv4 ranges → 0.0.0.0/0',
      'Protocols and ports: Specified → TCP → 6050,10000-20000',
      'Create — applies in a few seconds',
    ],
    note: 'Prefer target tags over "all instances" for production — tag your VM and reference that tag in the rule.',
  },
  digitalocean: {
    name: 'DigitalOcean',
    panel: 'Networking → Cloud Firewalls',
    docs: 'https://docs.digitalocean.com/products/networking/firewalls/',
    steps: [
      'DigitalOcean panel → Networking → Cloud Firewalls',
      'Click your firewall (or "Create Firewall")',
      'Inbound Rules → New Rule → Custom',
      'Type: Custom, Protocol: TCP, Port Range: 6050, Sources: All IPv4, All IPv6',
      'Add another: Custom / TCP / 10000-20000 / All IPv4, All IPv6',
      'Apply to: your Droplet',
      'Save Firewall',
    ],
  },
  hetzner: {
    name: 'Hetzner Cloud',
    panel: 'Firewalls → your firewall',
    docs: 'https://docs.hetzner.com/cloud/firewalls/overview',
    steps: [
      'Hetzner Console → Firewalls',
      'Select your firewall → Rules → Add Rule',
      'Direction: Inbound, Protocol: TCP, Port: 6050, Source IPs: 0.0.0.0/0 ::/0',
      'Add: Port range 10000-20000',
      'Apply → attach to your server if not already',
    ],
  },
  vultr: {
    name: 'Vultr',
    panel: 'Firewall → your firewall group',
    docs: 'https://www.vultr.com/docs/vultr-firewall/',
    steps: [
      'Vultr panel → Firewall → your group',
      'Add rule: Protocol TCP, Port 6050, Source 0.0.0.0/0',
      'Add rule: Protocol TCP, Port 10000-20000, Source 0.0.0.0/0',
      'Attach to your instance if not already',
    ],
  },
  linode: {
    name: 'Linode (Akamai)',
    panel: 'Cloud Firewall → your firewall',
    docs: 'https://www.linode.com/docs/products/networking/cloud-firewall/',
    steps: [
      'Linode Cloud Manager → Firewalls → your firewall',
      'Rules → Add an Inbound Rule',
      'Preset: None, Protocol: TCP, Port: 6050, Sources: All IPv4 + All IPv6',
      'Add another: Port range 10000-20000',
      'Save rules → attach to your Linode',
    ],
  },
};

function CopyCell({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-slate-400 hover:text-white transition">
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function CloudFirewallGuideCard() {
  const [active, setActive] = useState<ProviderKey>('aws');

  const portsList = PORTS.filter((p) => p.required).map((p) => p.port).join(', ');

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Cloud className="h-5 w-5 text-sky-400" /> Cloud Provider Firewall Setup
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          UFW on the server is configured by <code className="text-blue-400">install.sh</code>, but your <strong className="text-slate-300">cloud provider's firewall</strong> (VPC / Security Group / NSG) sits in front of the VM and blocks traffic before it even reaches UFW. Open these ports there too.
        </p>
      </div>

      {/* Port table */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Ports to Open</p>
        <div className="bg-[#0a0e14] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Port</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Protocol</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Purpose</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {PORTS.map((p) => (
                <tr key={p.port} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-3 py-2">
                    <span className={`font-mono ${p.required ? 'text-blue-400' : 'text-slate-400'}`}>{p.port}</span>
                    {!p.required && <span className="ml-2 text-xs text-slate-500">(optional)</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-400 font-mono text-xs">{p.proto}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs">{p.desc}</td>
                  <td className="px-3 py-2"><CopyCell text={p.port} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-slate-500">Source / CIDR: <code className="text-slate-300">0.0.0.0/0</code> (anyone) — restrict to your IP for private panels.</p>
          <button
            onClick={() => navigator.clipboard.writeText(portsList)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5"
          >
            <Copy className="h-3 w-3" /> Copy all required ports
          </button>
        </div>
      </div>

      {/* Provider tabs */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your Cloud Provider</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROVIDERS) as ProviderKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                active === key
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                  : 'bg-white/[0.03] border-white/[0.06] text-slate-300 hover:border-white/[0.15]'
              }`}
            >
              {PROVIDERS[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* Active provider guide */}
      <div className="bg-[#0a0e14] border border-white/[0.06] rounded-lg p-4">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-400" /> {PROVIDERS[active].name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Panel: <code className="text-slate-300">{PROVIDERS[active].panel}</code>
            </p>
          </div>
          <a
            href={PROVIDERS[active].docs}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          {PROVIDERS[active].steps.map((s, i) => (
            <li key={i} className="leading-relaxed">{s}</li>
          ))}
        </ol>

        {PROVIDERS[active].note && (
          <div className="mt-3 bg-amber-500/5 border border-amber-500/20 rounded px-3 py-2">
            <p className="text-xs text-amber-400"><strong>Note:</strong> {PROVIDERS[active].note}</p>
          </div>
        )}
      </div>

      {/* Troubleshooting */}
      <details className="bg-[#0a0e14] rounded-lg border border-white/[0.06]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-300 hover:text-white">
          Port open hai par still not accessible?
        </summary>
        <div className="px-4 pb-4 space-y-2 text-sm text-slate-400">
          <p>Check each layer one by one:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-xs">
            <li><strong className="text-slate-300">Cloud firewall</strong> — rules listed above (most common culprit)</li>
            <li><strong className="text-slate-300">UFW</strong> on the VM — <code className="text-blue-400">sudo ufw status</code> should list the port</li>
            <li><strong className="text-slate-300">iptables</strong> (Oracle, some AWS AMIs) — <code className="text-blue-400">sudo iptables -L -n</code></li>
            <li><strong className="text-slate-300">Service bound to 0.0.0.0?</strong> — <code className="text-blue-400">sudo ss -tlnp | grep 6050</code></li>
            <li><strong className="text-slate-300">Test from outside</strong> — <code className="text-blue-400">curl -v http://YOUR_IP:6050</code> from your laptop</li>
          </ol>
        </div>
      </details>
    </div>
  );
}
