import React, { useState, useEffect, useRef, useCallback } from 'react';
import { globalSearch } from '../lib/api';
import { 
  Search, 
  X, 
  FileText, 
  Users, 
  BookOpen, 
  ArrowRight,
  Clock
} from 'lucide-react';

interface GlobalSearchProps {
  onNavigate: (view: string, id?: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate, isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ requests: [], users: [], reports: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ requests: [], users: [], reports: [] });
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Parent should toggle
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults({ requests: [], users: [], reports: [] });
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(q);
        setResults(data || { requests: [], users: [], reports: [] });
      } catch {
        setResults({ requests: [], users: [], reports: [] });
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const allResults = [
    ...results.requests.map((r: any) => ({ type: 'request' as const, data: r })),
    ...results.users.map((u: any) => ({ type: 'user' as const, data: u })),
    ...results.reports.map((r: any) => ({ type: 'report' as const, data: r })),
  ];

  const handleSelect = (item: typeof allResults[0]) => {
    if (item.type === 'request') onNavigate('briefs', item.data.requestNumber || item.data.id);
    else if (item.type === 'user') onNavigate('members');
    else if (item.type === 'report') onNavigate('briefs', item.data.request?.requestNumber || item.data.request?.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      handleSelect(allResults[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); handleSearch(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="Search requests, reports, people..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#0037b0] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : allResults.length > 0 ? (
            <div className="py-2">
              {/* Requests */}
              {results.requests.length > 0 && (
                <div>
                  <div className="px-5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Research Requests</div>
                  {results.requests.map((r: any, i: number) => {
                    const idx = i;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelect({ type: 'request', data: r })}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-[#0037b0] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{r.title}</p>
                          <p className="text-[10px] text-gray-500">{r.requestNumber} • {r.status.replace(/_/g, ' ')}</p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Users */}
              {results.users.length > 0 && (
                <div>
                  <div className="px-5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">People</div>
                  {results.users.map((u: any, i: number) => {
                    const idx = results.requests.length + i;
                    return (
                      <button
                        key={u.id}
                        onClick={() => handleSelect({ type: 'user', data: u })}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-[#3a485c] text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {u.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900">{u.firstName} {u.lastName}</p>
                          <p className="text-[10px] text-gray-500">{u.role.replace(/_/g, ' ')}</p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Reports */}
              {results.reports.length > 0 && (
                <div>
                  <div className="px-5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reports</div>
                  {results.reports.map((r: any, i: number) => {
                    const idx = results.requests.length + results.users.length + i;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelect({ type: 'report', data: r })}
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate">{r.title}</p>
                          <p className="text-[10px] text-gray-500">v{r.version} • {r.request?.requestNumber}</p>
                        </div>
                        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : query.length >= 2 ? (
            <div className="text-center py-8">
              <Search className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-gray-400">Type at least 2 characters to search</p>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="text-[10px] text-gray-300 flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> Navigate
                </span>
                <span className="text-[10px] text-gray-300 flex items-center gap-1">
                  <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">↵</kbd> Select
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
