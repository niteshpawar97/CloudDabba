import { motion } from 'framer-motion';
import { GitBranch, Container, Shield, Terminal, Scan, Zap, Code2, FolderTree } from 'lucide-react';

const features = [
  {
    icon: Scan,
    title: 'Smart Auto-Detection',
    description: 'Scans your repo and auto-detects project type, frameworks, and structure. React, Vue, Express, NestJS — all recognized instantly.',
    color: 'from-amber-500 to-orange-500',
    glow: 'bg-amber-500/10',
  },
  {
    icon: FolderTree,
    title: 'Any Repo Structure',
    description: 'Monorepo, root-backend, separate dirs — CloudDabba reorganizes any structure into a standard layout before building.',
    color: 'from-purple-500 to-purple-600',
    glow: 'bg-purple-500/10',
  },
  {
    icon: Code2,
    title: 'TypeScript Native',
    description: 'Detects tsconfig.json and auto-transpiles TypeScript to JavaScript. No extra config needed from developers.',
    color: 'from-blue-500 to-blue-600',
    glow: 'bg-blue-500/10',
  },
  {
    icon: Container,
    title: 'Docker Native',
    description: 'Generates optimized Dockerfiles for each project type. Bring your own Dockerfile? We use it automatically.',
    color: 'from-cyan-500 to-cyan-600',
    glow: 'bg-cyan-500/10',
  },
  {
    icon: Shield,
    title: 'Free SSL & Subdomains',
    description: 'Every app gets a unique subdomain with automatic wildcard SSL via Let\'s Encrypt. HTTPS out of the box.',
    color: 'from-green-500 to-green-600',
    glow: 'bg-green-500/10',
  },
  {
    icon: Terminal,
    title: 'Real-time Logs',
    description: 'Stream build and runtime container logs live via WebSocket. Search, filter, and debug issues instantly.',
    color: 'from-pink-500 to-pink-600',
    glow: 'bg-pink-500/10',
  },
  {
    icon: GitBranch,
    title: 'GitHub Integration',
    description: 'Connect private or public repos. Deploy from any branch with one click. CI/CD via GitHub Actions supported.',
    color: 'from-slate-400 to-slate-500',
    glow: 'bg-slate-500/10',
  },
  {
    icon: Zap,
    title: 'Blazing Fast Deploys',
    description: 'Optimized Docker builds with layer caching. Most apps deploy in under 60 seconds on your own VPS.',
    color: 'from-yellow-500 to-amber-500',
    glow: 'bg-yellow-500/10',
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
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <div className={`absolute inset-0 ${feature.glow} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl`} />
              <div className="relative">
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
