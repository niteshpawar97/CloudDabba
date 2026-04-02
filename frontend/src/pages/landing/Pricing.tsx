import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    subtitle: 'Self-Hosted',
    price: '$0',
    period: 'forever',
    description: 'Deploy on your own VPS. Full control, no limits.',
    features: [
      'Unlimited apps',
      'Unlimited deployments',
      'Docker native support',
      'Free SSL (Let\'s Encrypt)',
      'Real-time logs',
      'GitHub integration',
      'Subdomain routing',
      'Community support',
    ],
    cta: 'Get Started',
    ctaLink: '/signup',
    highlight: false,
  },
  {
    name: 'Pro',
    subtitle: 'Managed Hosting',
    price: '$9',
    period: '/month',
    description: 'We manage the infrastructure. You just deploy.',
    features: [
      'Everything in Free',
      'Managed VPS included',
      'Auto SSL renewal',
      'Daily backups',
      'Priority support',
      'Custom domains',
      'Team collaboration',
      'Monitoring dashboard',
    ],
    cta: 'Coming Soon',
    ctaLink: '#',
    highlight: true,
    badge: 'Popular',
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-medium text-green-400 uppercase tracking-wider">Pricing</span>
          <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4">
            Start free,{' '}
            <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">scale when ready</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Self-host for free forever. Or let us manage everything for you.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`relative p-7 rounded-2xl border transition-all ${
                plan.highlight
                  ? 'bg-gradient-to-b from-blue-500/10 to-purple-500/5 border-blue-500/30'
                  : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 rounded-full text-xs font-medium">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-sm text-slate-500">{plan.subtitle}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-slate-500 text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-slate-400 mt-2">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-green-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={plan.ctaLink}
                className={`block text-center py-2.5 rounded-xl font-medium text-sm transition-all ${
                  plan.highlight
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
