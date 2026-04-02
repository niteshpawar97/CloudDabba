import { motion } from 'framer-motion';
import { GitFork, Scan, Rocket } from 'lucide-react';

const steps = [
  {
    step: '01',
    icon: GitFork,
    title: 'Connect Your Repo',
    description: 'Link your GitHub account or paste any public repo URL. CloudDabba supports private repos, public repos, and ZIP uploads.',
    visual: (
      <div className="bg-[#0a0e17] rounded-lg border border-white/10 p-4 font-mono text-xs">
        <div className="text-slate-500 mb-2">Select deployment source</div>
        <div className="space-y-1.5">
          {[
            { name: 'GitHub Private', tag: 'PAT', active: true },
            { name: 'Public Repo URL', tag: 'URL', active: false },
            { name: 'Upload ZIP', tag: 'ZIP', active: false },
          ].map((src) => (
            <div key={src.name} className={`flex items-center justify-between px-3 py-2 rounded ${src.active ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-white/5'}`}>
              <span className={src.active ? 'text-blue-400' : 'text-slate-400'}>{src.name}</span>
              <span className="text-[10px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">{src.tag}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    step: '02',
    icon: Scan,
    title: 'Smart Auto-Detection',
    description: 'CloudDabba scans your code, detects frameworks (React, Express, NestJS...), identifies TypeScript, and reorganizes any folder structure into a standard layout.',
    visual: (
      <div className="bg-[#0a0e17] rounded-lg border border-white/10 p-4 font-mono text-xs space-y-1">
        <div className="text-slate-500">Scanning repository...</div>
        <div className="text-amber-400">Detected: FULLSTACK [TypeScript]</div>
        <div className="text-slate-500">  backend: Express (./server)</div>
        <div className="text-slate-500">  frontend: React + Vite (./client)</div>
        <div className="text-purple-400">Reorganizing → /backend + /frontend</div>
        <div className="text-blue-400">TypeScript detected, building...</div>
        <div className="text-slate-500">Building Docker image...</div>
        <div className="text-green-400">Build complete (42s)</div>
      </div>
    ),
  },
  {
    step: '03',
    icon: Rocket,
    title: 'App Goes Live',
    description: 'Container starts, SSL configures automatically, subdomain routes. Your app is live with HTTPS — frontend served via nginx, API proxied to backend.',
    visual: (
      <div className="bg-[#0a0e17] rounded-lg border border-white/10 p-4 font-mono text-xs space-y-1">
        <div className="text-green-400">Container started on port 10000</div>
        <div className="text-blue-400">SSL: Secured (HTTPS)</div>
        <div className="text-slate-500">Frontend: nginx → /</div>
        <div className="text-slate-500">Backend:  proxy → /api</div>
        <div className="mt-2 pt-2 border-t border-white/5">
          <div className="text-green-300 font-semibold">Deployment successful!</div>
          <div className="text-cyan-400">https://myapp.clouddabba.dev</div>
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-purple-400 uppercase tracking-wider">How It Works</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Three steps to{' '}
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">production</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            No Docker knowledge required. No complex configs. Just push and deploy.
          </p>
        </motion.div>

        <div className="space-y-16">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`grid md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
            >
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl font-bold text-white/10">{step.step}</span>
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                    <step.icon className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed">{step.description}</p>
              </div>
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                {step.visual}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
