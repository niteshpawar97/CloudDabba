import { motion } from 'framer-motion';
import { Globe, Cpu, Server, Layers } from 'lucide-react';

const useCases = [
  {
    icon: Globe,
    title: 'SaaS Applications',
    description: 'Deploy full-stack SaaS products with backend APIs, frontend dashboards, and database connections.',
    tags: ['Next.js', 'Express', 'PostgreSQL'],
  },
  {
    icon: Cpu,
    title: 'IoT Dashboards',
    description: 'Host real-time monitoring dashboards for IoT devices with WebSocket support.',
    tags: ['React', 'WebSocket', 'MQTT'],
  },
  {
    icon: Server,
    title: 'Backend APIs',
    description: 'Deploy REST and GraphQL APIs with automatic health checks and container isolation.',
    tags: ['Express', 'Fastify', 'NestJS'],
  },
  {
    icon: Layers,
    title: 'Full-Stack Apps',
    description: 'Auto-detect and build monorepos with separate backend and frontend directories.',
    tags: ['Fullstack', 'Monorepo', 'Docker'],
  },
];

export function UseCases() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-cyan-400 uppercase tracking-wider">Use Cases</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Built for{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">every project</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="group p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              <uc.icon className="h-8 w-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{uc.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{uc.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {uc.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500">{tag}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
