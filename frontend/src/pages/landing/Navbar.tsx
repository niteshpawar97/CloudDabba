import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cloud, Menu, X } from 'lucide-react';

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
    >
      <div className="backdrop-blur-xl bg-[#06080f]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Cloud className="h-7 w-7 text-blue-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              CloudDabba
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="https://github.com/niteshpawar97/CloudDabba" target="_blank" className="hover:text-white transition-colors">GitHub</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/signup" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors">
              Get Started
            </Link>
          </div>

          <button onClick={() => setOpen(!open)} className="md:hidden text-slate-400">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden px-6 pb-4 space-y-3">
            <a href="#features" className="block text-slate-400 hover:text-white">Features</a>
            <a href="#how-it-works" className="block text-slate-400 hover:text-white">How It Works</a>
            <a href="#pricing" className="block text-slate-400 hover:text-white">Pricing</a>
            <Link to="/login" className="block text-slate-400 hover:text-white">Sign In</Link>
            <Link to="/signup" className="block text-blue-400">Get Started</Link>
          </div>
        )}
      </div>
    </motion.nav>
  );
}
