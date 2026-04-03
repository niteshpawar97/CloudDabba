import { motion } from 'framer-motion';
import { GitBranch, Container, Shield, Terminal, Scan, Zap, Code2, FolderTree } from 'lucide-react';
import { Icon3DPro } from '../../components/Icon3DPro';

const features = [
  {
    icon: Scan,
    title: 'Smart Auto-Detection',
    description: 'Scans your repo and auto-detects project type, frameworks, and structure. React, Vue, Express, NestJS — all recognized instantly.',
    gradient: 'from-amber-400 to-orange-500',
    shadow: 'rgba(251, 146, 60, 0.4)',
  },
  {
    icon: FolderTree,
    title: 'Any Repo Structure',
    description: 'Monorepo, root-backend, separate dirs — CloudDabba reorganizes any structure into a standard layout before building.',
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'rgba(139, 92, 246, 0.4)',
  },
  {
    icon: Code2,
    title: 'TypeScript Native',
    description: 'Detects tsconfig.json and auto-transpiles TypeScript to JavaScript. No extra config needed from developers.',
    gradient: 'from-blue-400 to-blue-600',
    shadow: 'rgba(59, 130, 246, 0.4)',
  },
  {
    icon: Container,
    title: 'Docker Native',
    description: 'Generates optimized Dockerfiles for each project type. Bring your own Dockerfile? We use it automatically.',
    gradient: 'from-cyan-400 to-cyan-600',
    shadow: 'rgba(6, 182, 212, 0.4)',
  },
  {
    icon: Shield,
    title: 'Free SSL & Subdomains',
    description: 'Every app gets a unique subdomain with automatic wildcard SSL via Let\'s Encrypt. HTTPS out of the box.',
    gradient: 'from-emerald-400 to-green-600',
    shadow: 'rgba(34, 197, 94, 0.4)',
  },
  {
    icon: Terminal,
    title: 'Real-time Logs',
    description: 'Stream build and runtime container logs live via WebSocket. Search, filter, and debug issues instantly.',
    gradient: 'from-pink-400 to-rose-600',
    shadow: 'rgba(244, 63, 94, 0.4)',
  },
  {
    icon: GitBranch,
    title: 'GitHub Integration',
    description: 'Connect private or public repos. Deploy from any branch. Auto-deploy on push via GitHub webhooks.',
    gradient: 'from-slate-300 to-slate-500',
    shadow: 'rgba(148, 163, 184, 0.35)',
  },
  {
    icon: Zap,
    title: 'Blazing Fast Deploys',
    description: 'Optimized Docker builds with layer caching. Most apps deploy in under 60 seconds on your own VPS.',
    gradient: 'from-yellow-400 to-amber-500',
    shadow: 'rgba(245, 158, 11, 0.4)',
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-blue-400 uppercase tracking-wider">Features</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">deploy with confidence</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            A complete deployment platform that handles the complexity so you can focus on building.
            No Docker knowledge required. No config files. Just push and deploy.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-300"
            >
              <div className="mb-5">
                <Icon3DPro
                  icon={feature.icon}
                  gradient={feature.gradient}
                  shadowColor={feature.shadow}
                  depth={0.5}
                  glowIntensity={0.7}
                  hoverStrength={0.8}
                  magnetic
                />
              </div>
              <h3 className="text-base font-semibold mb-2 text-white">{feature.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
