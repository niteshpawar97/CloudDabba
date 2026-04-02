import { useState, useEffect } from 'react';
import { getStats, getActivity } from '../../api/admin';
import { Spinner } from '../../components/ui/Spinner';
import { DeploymentStatusBadge } from '../../components/DeploymentStatusBadge';
import { Users, FolderOpen, Rocket, CheckCircle, XCircle, Container, Image } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePageTitle } from '../../hooks/usePageTitle';

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className={`h-5 w-5 ${color}`} />
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  );
}

export function AdminDashboard() {
  usePageTitle('Admin Dashboard');
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getActivity()])
      .then(([statsData, activityData]) => {
        setStats(statsData.stats);
        setChartData(statsData.chartData);
        setActivity(activityData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="lg" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers || 0} color="text-blue-400" />
        <StatCard icon={FolderOpen} label="Projects" value={stats?.totalProjects || 0} color="text-purple-400" />
        <StatCard icon={CheckCircle} label="Live Deployments" value={stats?.liveDeployments || 0} color="text-green-400" />
        <StatCard icon={XCircle} label="Failed" value={stats?.failedDeployments || 0} color="text-red-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Rocket} label="Total Deployments" value={stats?.totalDeployments || 0} color="text-amber-400" />
        <StatCard icon={Container} label="Containers" value={stats?.containers || 0} color="text-cyan-400" />
        <StatCard icon={Image} label="Docker Images" value={stats?.images || 0} color="text-pink-400" />
      </div>

      {/* Chart */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Deployments (Last 7 Days)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#475569" fontSize={12} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#475569" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
              />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#colorTotal)" strokeWidth={2} name="Total" />
              <Area type="monotone" dataKey="success" stroke="#22c55e" fill="url(#colorSuccess)" strokeWidth={2} name="Success" />
              <Area type="monotone" dataKey="failed" stroke="#ef4444" fill="none" strokeWidth={2} strokeDasharray="4 4" name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {activity.length === 0 && <p className="text-slate-500 text-sm">No recent activity</p>}
          {activity.map((a) => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
              <div className="flex items-center gap-3">
                <DeploymentStatusBadge status={a.status} />
                <div>
                  <span className="text-sm text-white font-medium">{a.project}</span>
                  <span className="text-xs text-slate-500 ml-2">by {a.user}</span>
                </div>
              </div>
              <span className="text-xs text-slate-500">{new Date(a.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
