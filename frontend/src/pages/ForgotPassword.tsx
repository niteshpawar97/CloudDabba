import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { KeyRound, Mail } from 'lucide-react';
import { forgotPassword } from '../api/auth';

export function ForgotPassword() {
  usePageTitle('Forgot Password');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 mb-4"><KeyRound className="h-6 w-6 text-blue-400" /></div>
        <h2 className="text-2xl font-bold text-white">Forgot your password?</h2>
        <p className="text-sm text-slate-500 mt-1">We'll email you a link to set a new one</p>
      </div>

      {sent ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm rounded-xl p-4 text-center">
          If that email is registered, a reset link is on its way. It is valid for 1 hour.
          <p className="text-xs text-slate-400 mt-2">No email? Ask your administrator for a reset link.</p>
        </div>
      ) : (
        <>
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-3 mb-6 text-center">{error}</div>}
          <form onSubmit={submit} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-3 top-9.5 h-4 w-4 text-slate-500" />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="pl-10" />
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">Send reset link</Button>
          </form>
        </>
      )}

      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300 font-medium">Back to Sign In</Link>
      </div>
    </div>
  );
}
