import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getUsers } from '../lib/api';
import { Users, Search, Loader2, AlertCircle, RefreshCw, Mail, Phone } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'MP', label: 'Members of Parliament' },
  { value: 'RESEARCH_OFFICER', label: 'Research Officers' },
  { value: 'ADMIN', label: 'Administrators' },
] as const;

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  MP: { label: 'Member of Parliament', className: 'bg-[#dce1ff] text-[#0037b0]' },
  RESEARCH_OFFICER: { label: 'Research Officer', className: 'bg-emerald-100 text-emerald-800' },
  ADMIN: { label: 'Administrator', className: 'bg-purple-100 text-purple-800' },
};

export const MembersView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers({
        role: role || undefined,
        search: debouncedSearch || undefined,
      });
      if (Array.isArray(data)) setUsers(data);
      else setUsers([]);
    } catch (err: any) {
      setUsers([]);
      setError(err?.message || 'Failed to load the directory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [role, debouncedSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-[#c4c5d7] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0037b0] placeholder:text-gray-400"
              />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="py-2 px-3 bg-white border border-[#c4c5d7] rounded-lg text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#0037b0]"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-500 font-semibold whitespace-nowrap">
            {loading ? 'Loading...' : `${users.length} ${users.length === 1 ? 'user' : 'users'}`}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs font-semibold">Loading directory...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-gray-600 font-semibold">{error}</p>
              <button
                onClick={fetchUsers}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0037b0] hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                    <th className="px-2 pb-3">Member</th>
                    <th className="px-2 pb-3">Department</th>
                    <th className="px-2 pb-3">Role</th>
                    <th className="px-2 pb-3 text-center">Requests</th>
                    <th className="px-2 pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => {
                    const badge = ROLE_BADGES[u.role] || { label: u.role.replace('_', ' '), className: 'bg-slate-100 text-[#515f74]' };
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-2 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${u.isActive ? 'bg-[#dce1ff] text-[#001551]' : 'bg-gray-200 text-gray-400'}`}>
                              {u.initials}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">
                                {u.firstName} {u.lastName}
                                {u.role === 'MP' && (
                                  <span className="ml-1.5 text-[10px] font-semibold text-[#0037b0]">Hon.</span>
                                )}
                              </p>
                              <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3 text-gray-300" /> {u.email}
                              </p>
                              {u.phone && (
                                <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-300" /> {u.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3.5 text-xs text-gray-600">
                          {u.department?.name || '—'}
                        </td>
                        <td className="px-2 py-3.5">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-2 py-3.5 text-center">
                          <span className="text-xs font-bold text-gray-700">{u._count?.submittedRequests ?? 0}</span>
                          <span className="text-[10px] text-gray-400"> submitted</span>
                        </td>
                        <td className="px-2 py-3.5 text-right">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-14">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">
                {search || role ? 'No users match your filters' : 'No users found'}
              </p>
              {(search || role) && (
                <button
                  onClick={() => { setSearch(''); setRole(''); }}
                  className="mt-2 text-xs font-bold text-[#0037b0] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
