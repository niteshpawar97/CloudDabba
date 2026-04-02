import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

const features = [
  { name: 'Self-hosted', cloudDabba: true, vercel: false, render: false },
  { name: 'Open Source', cloudDabba: true, vercel: false, render: false },
  { name: 'Docker Support', cloudDabba: true, vercel: false, render: true },
  { name: 'Free SSL', cloudDabba: true, vercel: true, render: true },
  { name: 'Custom Domains', cloudDabba: true, vercel: true, render: true },
  { name: 'Real-time Logs', cloudDabba: true, vercel: true, render: true },
  { name: 'No Vendor Lock-in', cloudDabba: true, vercel: false, render: false },
  { name: 'Unlimited Apps', cloudDabba: true, vercel: 'paid', render: 'paid' },
  { name: 'Full-stack Auto Detect', cloudDabba: true, vercel: 'partial', render: false },
  { name: 'Data Stays on Your Server', cloudDabba: true, vercel: false, render: false },
];

function CellIcon({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-green-400" />;
  if (value === false) return <X className="h-4 w-4 text-slate-600" />;
  return <span className="text-xs text-amber-400">{value}</span>;
}

export function Comparison() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="text-sm font-medium text-amber-400 uppercase tracking-wider">Comparison</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
            How CloudDabba{' '}
            <span className="bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">stands out</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-white/[0.06] overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="text-left py-4 px-6 font-medium text-slate-400">Feature</th>
                <th className="py-4 px-4 font-semibold text-blue-400">CloudDabba</th>
                <th className="py-4 px-4 font-medium text-slate-400">Vercel</th>
                <th className="py-4 px-4 font-medium text-slate-400">Render</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.name} className={`border-t border-white/[0.04] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                  <td className="py-3 px-6 text-slate-300">{f.name}</td>
                  <td className="py-3 px-4 text-center"><CellIcon value={f.cloudDabba} /></td>
                  <td className="py-3 px-4 text-center"><CellIcon value={f.vercel} /></td>
                  <td className="py-3 px-4 text-center"><CellIcon value={f.render} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
