import { motion } from 'framer-motion';
import { Scan, FolderTree, ArrowRight, Check, Sparkles } from 'lucide-react';

const frontendFrameworks = [
  { name: 'React', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { name: 'Next.js', color: 'text-white', bg: 'bg-white/10' },
  { name: 'Vue', color: 'text-green-400', bg: 'bg-green-500/10' },
  { name: 'Angular', color: 'text-red-400', bg: 'bg-red-500/10' },
  { name: 'Svelte', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { name: 'Astro', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { name: 'Gatsby', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { name: 'Nuxt', color: 'text-green-400', bg: 'bg-green-500/10' },
  { name: 'SvelteKit', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { name: 'Solid.js', color: 'text-blue-400', bg: 'bg-blue-500/10' },
];

const backendFrameworks = [
  { name: 'Express', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { name: 'Fastify', color: 'text-white', bg: 'bg-white/10' },
  { name: 'NestJS', color: 'text-red-400', bg: 'bg-red-500/10' },
  { name: 'Koa', color: 'text-slate-300', bg: 'bg-slate-500/10' },
  { name: 'Hapi', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { name: 'AdonisJS', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { name: 'Restify', color: 'text-green-400', bg: 'bg-green-500/10' },
];

const repoStructures = [
  {
    title: 'Standard Layout',
    description: 'Backend and frontend in separate folders at root level',
    pattern: [
      { name: 'my-project/', type: 'root' },
      { name: '  backend/', type: 'backend' },
      { name: '    package.json', type: 'file' },
      { name: '    src/', type: 'folder' },
      { name: '  frontend/', type: 'frontend' },
      { name: '    package.json', type: 'file' },
      { name: '    src/', type: 'folder' },
    ],
    detected: 'FULLSTACK',
    detectedLabel: 'backend/ + frontend/',
  },
  {
    title: 'Root Backend',
    description: 'Backend at root with frontend in a subfolder like client/',
    pattern: [
      { name: 'my-project/', type: 'root' },
      { name: '  server.js', type: 'file' },
      { name: '  package.json', type: 'file' },
      { name: '  routes/', type: 'folder' },
      { name: '  client/', type: 'frontend' },
      { name: '    package.json', type: 'file' },
      { name: '    src/', type: 'folder' },
    ],
    detected: 'FULLSTACK',
    detectedLabel: 'root + client/',
  },
  {
    title: 'Monorepo',
    description: 'Workspace-based project with packages in subdirectories',
    pattern: [
      { name: 'my-project/', type: 'root' },
      { name: '  package.json', type: 'file' },
      { name: '  packages/', type: 'folder' },
      { name: '    api/', type: 'backend' },
      { name: '      package.json', type: 'file' },
      { name: '    web/', type: 'frontend' },
      { name: '      package.json', type: 'file' },
    ],
    detected: 'FULLSTACK',
    detectedLabel: 'packages/api + packages/web',
  },
  {
    title: 'Single App',
    description: 'Standalone frontend or backend — auto-detected and deployed',
    pattern: [
      { name: 'my-api/', type: 'root' },
      { name: '  package.json', type: 'file' },
      { name: '  tsconfig.json', type: 'ts' },
      { name: '  src/', type: 'folder' },
      { name: '    index.ts', type: 'file' },
      { name: '    routes/', type: 'folder' },
    ],
    detected: 'NODE_BACKEND',
    detectedLabel: 'TypeScript backend',
  },
];

function getFileColor(type: string) {
  switch (type) {
    case 'root': return 'text-blue-400';
    case 'backend': return 'text-amber-400';
    case 'frontend': return 'text-green-400';
    case 'ts': return 'text-blue-300';
    case 'folder': return 'text-slate-500';
    case 'file': return 'text-slate-600';
    default: return 'text-slate-500';
  }
}

const smartFeatures = [
  'Auto-detects project type from package.json',
  'TypeScript → auto-transpiled before deploy',
  'Monorepo workspaces automatically resolved',
  'Custom Dockerfile? We use yours instead',
  'No config files needed from developers',
  'Any folder structure → standardized before build',
];

export function SmartDetection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-amber-400 uppercase tracking-wider">Smart Detection</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Push any repo.{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">We figure out the rest.</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            CloudDabba scans your repository, detects frameworks, identifies TypeScript,
            resolves monorepo structures, and builds optimized Docker containers — all automatically.
          </p>
        </motion.div>

        {/* Smart features checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto mb-20"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            {smartFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-green-400" />
                </div>
                <span className="text-sm text-slate-300">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Supported Frameworks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h3 className="text-center text-lg font-semibold text-white mb-8">
            <Sparkles className="inline h-5 w-5 text-amber-400 mr-2" />
            Frameworks We Auto-Detect
          </h3>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Frontend */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-xs uppercase tracking-wider text-green-400 font-medium mb-4">Frontend</div>
              <div className="flex flex-wrap gap-2">
                {frontendFrameworks.map((fw) => (
                  <span key={fw.name} className={`${fw.bg} ${fw.color} text-sm px-3 py-1.5 rounded-lg font-medium`}>
                    {fw.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Backend */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-xs uppercase tracking-wider text-amber-400 font-medium mb-4">Backend</div>
              <div className="flex flex-wrap gap-2">
                {backendFrameworks.map((fw) => (
                  <span key={fw.name} className={`${fw.bg} ${fw.color} text-sm px-3 py-1.5 rounded-lg font-medium`}>
                    {fw.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-4">
            <span className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500/50" /> TypeScript auto-detected
            </span>
            <span className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500/50" /> Static sites (HTML/CSS)
            </span>
            <span className="text-xs text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500/50" /> Custom Dockerfile
            </span>
          </div>
        </motion.div>

        {/* Repo Structure Detection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-center text-lg font-semibold text-white mb-3">
            <FolderTree className="inline h-5 w-5 text-amber-400 mr-2" />
            Any Repo Structure. Zero Config.
          </h3>
          <p className="text-center text-sm text-slate-500 mb-8 max-w-xl mx-auto">
            No matter how your project is organized, CloudDabba reorganizes it into a
            standard layout and builds optimized containers automatically.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {repoStructures.map((structure, i) => (
              <motion.div
                key={structure.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                <h4 className="text-sm font-semibold text-white mb-1">{structure.title}</h4>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">{structure.description}</p>

                {/* File tree */}
                <div className="bg-[#0a0e17] rounded-lg border border-white/[0.06] p-3 mb-4 font-mono text-[11px] leading-[1.8]">
                  {structure.pattern.map((item, j) => (
                    <div key={j} className={getFileColor(item.type)}>
                      {item.name}
                    </div>
                  ))}
                </div>

                {/* Detection result */}
                <div className="flex items-center gap-2">
                  <Scan className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                      {structure.detected}
                    </span>
                    <div className="text-[10px] text-slate-600 mt-1">{structure.detectedLabel}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* How it works - visual flow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-4">
              {[
                { label: 'Your Repo', sub: 'Any structure', color: 'border-blue-500/30 text-blue-400' },
                { label: 'Scan', sub: 'Auto-detect', color: 'border-amber-500/30 text-amber-400', isArrow: true },
                { label: 'Reorganize', sub: 'Standard layout', color: 'border-purple-500/30 text-purple-400', isArrow: true },
                { label: 'Build', sub: 'Docker image', color: 'border-cyan-500/30 text-cyan-400', isArrow: true },
                { label: 'Deploy', sub: 'Live on HTTPS', color: 'border-green-500/30 text-green-400', isArrow: true },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 sm:gap-4">
                  {step.isArrow && (
                    <ArrowRight className="h-4 w-4 text-slate-700 hidden sm:block" />
                  )}
                  <div className={`px-4 py-2.5 rounded-xl border ${step.color} bg-white/[0.02] text-center`}>
                    <div className="text-xs font-semibold">{step.label}</div>
                    <div className="text-[10px] text-slate-500">{step.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
