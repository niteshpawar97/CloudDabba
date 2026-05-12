import { Cloud } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid sm:grid-cols-4 gap-8 mb-12">
          <div className="sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="h-6 w-6 text-blue-500" />
              <span className="text-lg font-bold">CloudDabba</span>
            </div>
            <p className="text-sm text-slate-500">
              Self-hosted PaaS platform. Deploy GitHub repos as Docker containers.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-slate-300">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-slate-300">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link to="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><a href="https://github.com/niteshpawar97/CloudDabba" target="_blank" className="hover:text-white transition-colors">GitHub</a></li>
              <li><a href="https://github.com/niteshpawar97/CloudDabba/issues" target="_blank" className="hover:text-white transition-colors">Report Issue</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3 text-slate-300">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-600">
            &copy; {new Date().getFullYear()} CloudDabba. Open source under MIT License.
          </p>
          <p className="text-sm text-slate-600">
            Made with passion in India
          </p>
        </div>
      </div>
    </footer>
  );
}
