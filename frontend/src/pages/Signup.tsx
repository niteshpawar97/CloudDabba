import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { UserPlus, User, Mail, Lock } from 'lucide-react';

export function Signup() {
  usePageTitle('Create Account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({ name, email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-green-500/10 mb-4">
          <UserPlus className="h-6 w-6 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">Start deploying in minutes</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-3 mb-6 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative">
          <User className="absolute left-3 top-9.5 h-4 w-4 text-slate-500" />
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your full name"
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Mail className="absolute left-3 top-9.5 h-4 w-4 text-slate-500" />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-9.5 h-4 w-4 text-slate-500" />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Min 6 characters"
            className="pl-10"
          />
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Create Account
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
