import { motion } from 'framer-motion';
import { GitBranch, Container, Shield, Terminal, Layers, Zap } from 'lucide-react';

const features = [
  {
    icon: GitBranch,
    title: 'Auto Deploy from GitHub',
    description: 'Connect your repo, push code, and watch it deploy automatically. Public and private repos supported.',
    color: 'from-blue-500 to-blue-600',
    glow: 'bg-blue-500/10',
  },
  {
    icon: Container,
    title: 'Docker Native Support',
    description: 'Auto-detects project type and generates optimized Dockerfiles. Node.js, React, Next.js, and static sites.',
    color: 'from-purple-500 to-purple-600',
    glow: 'bg-purple-500/10',
  },
  {
    icon: Shield,
    title: 'Free SSL Certificates',
    description: 'Automatic wildcard SSL via Let\'s Encrypt. Every deployed app gets HTTPS out of the box.',
    color: 'from-green-500 to-green-600',
    glow: 'bg-green-500/10',
  },
  {
    icon: Terminal,
    title: 'Real-time Logs',
    description: 'Watch build and runtime logs stream live via WebSocket. Debug issues instantly.',
    color: 'from-cyan-500 to-cyan-600',
    glow: 'bg-cyan-500/10',
  },
  {
    icon: Layers,
    title: 'Multi-App Hosting',
    description: 'Deploy unlimited apps on a single VPS. Each app gets its own subdomain and isolated container.',
    color: 'from-amber-500 to-amber-600',
    glow: 'bg-amber-500/10',
  },
  {
    icon: Zap,
    title: 'Blazing Fast Deploys',
    description: 'Optimized Docker builds with layer caching. Most apps deploy in under 60 seconds.',
    color: 'from-pink-500 to-pink-600',
    glow: 'bg-pink-500/10',
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
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <div className={`absolute inset-0 ${feature.glow} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl`} />
              <div className="relative">
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
