import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Cloud, Server, Container, GitBranch } from 'lucide-react';
import { Icon3DPro, FloatingIcon3D } from '../../components/Icon3DPro';

function HeroVisual() {
  return (
    <div className="relative w-full h-[400px] lg:h-[500px]">
      {/* Main glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-600/20 rounded-full blur-[80px]" />
      <div className="absolute top-1/3 left-1/3 w-48 h-48 bg-purple-600/15 rounded-full blur-[60px]" />

      {/* Central cloud - 3D Pro */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="relative">
          <Icon3DPro
            icon={Cloud}
            gradient="from-blue-500 to-purple-600"
            shadowColor="rgba(59, 130, 246, 0.5)"
            size="xl"
            depth={0.8}
            glowIntensity={0.9}
            hoverStrength={0.6}
            animSpeed={6}
            magnetic
          />
          {/* Connection lines */}
          <svg className="absolute -top-8 -left-16 w-64 h-48 pointer-events-none" viewBox="0 0 256 192">
            <motion.line x1="128" y1="96" x2="40" y2="24" stroke="url(#grad1)" strokeWidth="1" strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity }} />
            <motion.line x1="128" y1="96" x2="216" y2="24" stroke="url(#grad2)" strokeWidth="1" strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} />
            <motion.line x1="128" y1="96" x2="40" y2="168" stroke="url(#grad1)" strokeWidth="1" strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }} />
            <motion.line x1="128" y1="96" x2="216" y2="168" stroke="url(#grad2)" strokeWidth="1" strokeDasharray="4 4"
              animate={{ strokeDashoffset: [0, -20] }} transition={{ duration: 2, repeat: Infinity, delay: 1.5 }} />
            <defs>
              <linearGradient id="grad1"><stop stopColor="#3b82f6" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
              <linearGradient id="grad2"><stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#06b6d4" /></linearGradient>
            </defs>
          </svg>
        </div>
      </motion.div>

      {/* Floating icons - different Z depths for parallax */}
      <FloatingIcon3D icon={Server} className="absolute top-8 left-8 text-blue-400" delay={0} speed={0.8} zDepth={0.9} shadowColor="rgba(59,130,246,0.35)" />
      <FloatingIcon3D icon={Container} className="absolute top-8 right-12 text-purple-400" delay={0.5} speed={1.1} zDepth={0.6} shadowColor="rgba(139,92,246,0.35)" />
      <FloatingIcon3D icon={GitBranch} className="absolute bottom-12 left-12 text-cyan-400" delay={1} speed={0.9} zDepth={0.4} shadowColor="rgba(6,182,212,0.3)" />
      <FloatingIcon3D icon={Cloud} className="absolute bottom-8 right-8 text-blue-300" delay={1.5} speed={1.2} zDepth={0.8} shadowColor="rgba(96,165,250,0.35)" />

      {/* Terminal preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72"
      >
        <div className="bg-[#0a0e17] rounded-lg border border-white/10 p-3 font-mono text-xs shadow-2xl backdrop-blur-sm">
          <div className="flex gap-1.5 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="space-y-1">
            <div className="text-slate-500">$ git push origin main</div>
            <div className="text-green-400">Deploying to clouddabba.dev...</div>
            <div className="text-blue-400">Building Docker image...</div>
            <div className="text-purple-400">Container started on port 10000</div>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-green-300"
            >
              App is live at myapp.clouddabba.dev
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Open Source & Self-Hosted
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Deploy Your Apps{' '}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              in Seconds
            </span>
            <br />
            Own Your Cloud
          </h1>

          <p className="text-lg text-slate-400 max-w-lg mb-8 leading-relaxed">
            From GitHub to production in one click. Full-stack support with Docker containers, auto SSL, real-time logs, and subdomain routing.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-all"
            >
              <Play className="h-4 w-4" />
              See How It Works
            </a>
          </div>

          <div className="flex items-center gap-6 mt-10 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              Docker Native
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              Free SSL
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400" />
              Real-time Logs
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}
