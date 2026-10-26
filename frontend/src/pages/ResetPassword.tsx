import { useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Lock, ShieldCheck } from 'lucide-react';
import { resetPassword } from '../api/auth';

export function ResetPassword() {
  usePageTitle('Reset Password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-slate-300">This reset link is missing its token.</p>
        <Link to="/forgot-password" className="inline-block mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium">Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 mb-4"><ShieldCheck className="h-6 w-6 text-emerald-400" /></div>
        <h2 className="text-2xl font-bold text-white">Password updated</h2>
        <p className="text-sm text-slate-400 mt-2">You can now sign in with your new password. Other sessions were signed out.</p>
        <Link to="/login" className="inline-block mt-6 text-blue-400 hover:text-blue-300 text-sm font-medium">Go to Sign In</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 mb-4"><Lock className="h-6 w-6 text-blue-400" /></div>
        <h2 className="text-2xl font-bold text-white">Set a new password</h2>
      </div>
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-3 mb-6 text-center">{error}</div>}
      <form onSubmit={submit} className="space-y-5">
        <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" />
        <Input label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
        <Button type="submit" loading={loading} className="w-full" size="lg">Update password</Button>
      </form>
    </div>
  );
}
