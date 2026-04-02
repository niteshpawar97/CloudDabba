import { usePageTitle } from '../../hooks/usePageTitle';
import { Hero } from './Hero';
import { Features } from './Features';
import { SmartDetection } from './SmartDetection';
import { HowItWorks } from './HowItWorks';
import { UseCases } from './UseCases';
import { Comparison } from './Comparison';
import { Pricing } from './Pricing';
import { FinalCTA } from './FinalCTA';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function LandingPage() {
  usePageTitle();
  return (
    <div className="min-h-screen bg-[#06080f] text-white overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Features />
        <SmartDetection />
        <HowItWorks />
        <UseCases />
        <Comparison />
        <Pricing />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
