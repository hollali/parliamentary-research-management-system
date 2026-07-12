import React, { useState, useEffect } from 'react';
import { getUsers } from '../lib/api';
import { Users } from 'lucide-react';

export const MembersView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers()
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-center justify-between">
          <h3 className="font-sans font-bold text-gray-900">Parliamentary Directories</h3>
          <span className="text-xs text-gray-500 font-semibold">{users.length} users</span>
        </div>
        <div className="p-6 divide-y divide-gray-100">
          {loading ? (
            <p className="text-xs text-gray-400 italic py-4">Loading users...</p>
          ) : users.length > 0 ? (
            users.map((u) => (
              <div key={u.id} className="py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#dce1ff] text-[#001551] flex items-center justify-center font-bold text-xs">
                    {u.initials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{u.firstName} {u.lastName}</p>
                    <p className="text-[10px] text-gray-500">{u.title || u.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-[#515f74] px-2.5 py-1 rounded-full font-bold">
                  {u.department?.name || u.role.replace('_', ' ')}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No users found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
