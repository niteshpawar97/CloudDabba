import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSetupStatus, completeSetup } from '../api/setup';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Cloud, Globe, Lock, ArrowRight, Check, Rocket } from 'lucide-react';

export function SetupWizard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    getSetupStatus().then((s) => {
      if (s.setupCompleted) navigate('/', { replace: true });
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setSubmitting(true);
    setStep(4);
    try {
      const result = await completeSetup({ domain, email, password, name });
      if (result.token) localStorage.setItem('token', result.token);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Setup failed');
      setStep(3);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#06080f]"><Spinner size="lg" /></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06080f] relative overflow-hidden px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Cloud className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">CloudDabba</h1>
          </div>
          <p className="text-slate-500 text-sm">First-time setup</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-0 mb-8 max-w-xs mx-auto">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s || done ? 'bg-green-500 text-white' : step === s ? 'bg-blue-500 text-white' : 'bg-[#1a1f2e] text-slate-500'
                }`}>
                  {step > s || done ? <Check className="h-3.5 w-3.5" /> : s}
                </div>
              </div>
              {i < 2 && <div className={`h-[2px] flex-1 mx-1 rounded-full ${step > s ? 'bg-green-500/50' : 'bg-white/[0.06]'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm rounded-2xl p-8">
          {error && <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg p-3 mb-4">{error}</div>}

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <Rocket className="h-12 w-12 text-blue-400 mx-auto" />
              <h2 className="text-xl font-bold text-white">Welcome to CloudDabba</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your self-hosted PaaS platform is almost ready. Let's configure your domain and create an admin account.
              </p>
              <Button onClick={() => setStep(2)} size="lg" className="w-full">
                <span className="flex items-center justify-center gap-2">Get Started <ArrowRight className="h-4 w-4" /></span>
              </Button>
            </div>
          )}

          {/* Step 2: Domain & Email */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Globe className="h-5 w-5 text-blue-400" /> Platform Domain</h2>
              <Input label="Base Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="clouddabba.yourdomain.com" required />
              <p className="text-xs text-slate-500">Point this domain (and *.domain) to your server's IP via A record.</p>
              <Input label="Admin Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => { if (domain && email) setStep(3); }} className="flex-1" disabled={!domain || !email}>
                  <span className="flex items-center justify-center gap-2">Next <ArrowRight className="h-4 w-4" /></span>
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Admin Account */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Lock className="h-5 w-5 text-blue-400" /> Admin Account</h2>
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" required />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required />
              <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={!name || !password || !confirmPassword} loading={submitting}>
                  <span className="flex items-center justify-center gap-2">Complete Setup <Check className="h-4 w-4" /></span>
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Progress / Done */}
          {step === 4 && (
            <div className="text-center space-y-4 py-4">
              {!done ? (
                <>
                  <Spinner size="lg" />
                  <p className="text-slate-400">Setting up your platform...</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                    <Check className="h-8 w-8 text-green-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Setup Complete!</h2>
                  <div className="bg-[#0a0e14] rounded-xl p-4 text-left space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Domain</span>
                      <span className="text-white">{domain}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Admin</span>
                      <span className="text-white">{email}</span>
                    </div>
                  </div>
                  <Button onClick={() => navigate('/dashboard', { replace: true })} size="lg" className="w-full">
                    <span className="flex items-center justify-center gap-2"><Rocket className="h-4 w-4" /> Go to Dashboard</span>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
