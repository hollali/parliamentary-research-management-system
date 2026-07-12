import React, { useState, useEffect } from 'react';
import { Search, Database } from 'lucide-react';
import { getRequests } from '../lib/api';

interface ArchiveViewProps {
  onNavigate: (view: string, id: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ onNavigate }) => {
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getRequests({ status: 'APPROVED' })
      .then((data) => {
        if (Array.isArray(data)) setArchived(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = archived.filter(r => {
    const q = search.toLowerCase();
    return !q || r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-8 shadow-sm space-y-5 max-w-4xl mx-auto">
        <h3 className="text-lg font-sans font-bold text-gray-900">Legislative Archival Vault</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Search the historical repository of delivered briefings and statistical summaries from previous legislative terms.
        </p>
        
        {/* Vault search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search archival ID, keyword, or legislation name..." 
            className="w-full bg-gray-50 border border-[#c4c5d7] rounded-full pl-10 pr-4 py-2 text-xs outline-none"
          />
        </div>

        <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
          {loading ? (
            <p className="text-xs text-gray-400 italic py-4 text-center">Loading archive...</p>
          ) : filtered.length > 0 ? (
            filtered.map((r) => (
              <div key={r.id} className="p-3.5 flex justify-between items-center hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-[#515f74]" />
                  <div>
                    <p className="text-xs font-bold text-gray-900">{r.title}</p>
                    <p className="text-[10px] text-gray-500">{r.id} • {r.dateSubmitted || 'Completed'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigate('briefs', r.id)}
                  className="text-xs font-bold text-[#0037b0] hover:underline"
                >
                  Retrieve
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No archived briefs found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
