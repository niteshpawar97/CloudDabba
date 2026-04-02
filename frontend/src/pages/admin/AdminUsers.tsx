import { useState, useEffect } from 'react';
import { getUsers, updateUserRole, deleteUser } from '../../api/admin';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Search, Trash2, Shield, User } from 'lucide-react';

export function AdminUsers() {
  const [data, setData] = useState<any>({ users: [], pagination: {} });
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchUsers = () => {
    setLoading(true);
    getUsers(page, search).then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchUsers(); }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRoleChange = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role to ${newRole}?`)) return;
    await updateUserRole(id, newRole);
    fetchUsers();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"? This will delete all their projects and deployments.`)) return;
    await deleteUser(id);
    fetchUsers();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <span className="text-sm text-slate-400">{data.pagination.total || 0} total</span>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
        <Input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-left">
              <th className="py-3 px-4 font-medium text-slate-400">User</th>
              <th className="py-3 px-4 font-medium text-slate-400">Role</th>
              <th className="py-3 px-4 font-medium text-slate-400">GitHub</th>
              <th className="py-3 px-4 font-medium text-slate-400">Projects</th>
              <th className="py-3 px-4 font-medium text-slate-400">Joined</th>
              <th className="py-3 px-4 font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u: any) => (
              <tr key={u.id} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                <td className="py-3 px-4">
                  <div className="text-white font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="py-3 px-4">
                  <Badge variant={u.role === 'admin' ? 'danger' : 'default'}>
                    {u.role === 'admin' ? 'Admin' : 'User'}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  <Badge variant={u.hasPAT ? 'success' : 'default'}>
                    {u.hasPAT ? 'Connected' : 'Not set'}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-slate-300">{u.projectCount}</td>
                <td className="py-3 px-4 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRoleChange(u.id, u.role)}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-blue-400 transition-colors"
                      title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    >
                      {u.role === 'admin' ? <User className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.users.length === 0 && (
          <div className="text-center py-8 text-slate-500">No users found</div>
        )}
      </div>

      {data.pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: data.pagination.pages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded text-sm ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
