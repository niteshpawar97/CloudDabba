import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Cloud } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-cyan-600/20" />
          <div className="absolute inset-0 bg-[#0a0e17]/80 backdrop-blur-xl" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-[80px]" />

          <div className="relative py-16 px-8 text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex mb-6"
            >
              <Cloud className="h-12 w-12 text-blue-400" />
            </motion.div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Start deploying{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">in minutes</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8">
              Open source, self-hosted, and free forever. Your code, your server, your rules.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/signup"
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-medium text-lg transition-all shadow-lg shadow-blue-500/25"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://github.com/niteshpawar97/CloudDabba"
                target="_blank"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-lg transition-all"
              >
                View on GitHub
              </a>
            </div>

            <div className="flex items-center justify-center gap-8 mt-10 text-sm text-slate-500">
              <span>No credit card required</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>Self-hosted</span>
              <span className="w-1 h-1 rounded-full bg-slate-700" />
              <span>Open source</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
