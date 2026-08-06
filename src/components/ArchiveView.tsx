import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Database, 
  ChevronDown, 
  X, 
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  ShieldCheck,
  FileText,
  Paperclip
} from 'lucide-react';
import { getRequests, downloadFile } from '../lib/api';
import { honourable } from '../lib/format';
import { useToast } from '../lib/toast';
import { useApp } from '../context/AppContext';
import { Pagination } from './Pagination';

interface ArchiveViewProps {
  onNavigate: (view: string, id: string) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ onNavigate }) => {
  const { currentUser } = useApp();
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortField, setSortField] = useState<string>('dateSubmitted');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [viewRequest, setViewRequest] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getRequests({ limit: 200 })
      .then((data) => {
        const requests = Array.isArray(data) ? data : (data?.requests || []);
        setArchived(requests.filter((r: any) => ['APPROVED', 'DELIVERED', 'CLOSED'].includes(r.status)));
        setLoading(false);
      })
      .catch(() => { setLoading(false); console.warn('Failed to load archived requests'); });
  }, []);

  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    archived.forEach((r: any) => {
      const name = r.category?.name || r.category;
      if (name) cats.add(name);
    });
    return Array.from(cats).sort();
  }, [archived]);

  const statuses = [
    { value: 'APPROVED', label: 'Approved' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CLOSED', label: 'Closed' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Approved</span>;
      case 'DELIVERED':
        return <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Delivered</span>;
      case 'CLOSED':
        return <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Closed</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{status}</span>;
    }
  };

  const filtered = React.useMemo(() => {
    return archived.filter((r: any) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (r.requestNumber || r.id || '').toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.submitter ? `${r.submitter.firstName} ${r.submitter.lastName}` : '').toLowerCase().includes(q);

      const catName = r.category?.name || r.category || '';
      const matchesCategory = !selectedCategory || catName === selectedCategory;
      const matchesStatus = !selectedStatus || r.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [archived, searchQuery, selectedCategory, selectedStatus]);

  const isFiltered = searchQuery !== '' || selectedCategory !== '' || selectedStatus !== '';

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let aVal: string, bVal: string;
      switch (sortField) {
        case 'id': aVal = a.requestNumber || a.id || ''; bVal = b.requestNumber || b.id || ''; break;
        case 'title': aVal = a.title || ''; bVal = b.title || ''; break;
        case 'member': aVal = a.submitter ? `${a.submitter.firstName} ${a.submitter.lastName}` : ''; bVal = b.submitter ? `${b.submitter.firstName} ${b.submitter.lastName}` : ''; break;
        case 'status': aVal = a.status || ''; bVal = b.status || ''; break;
        case 'dateSubmitted': aVal = a.dateSubmitted || ''; bVal = b.dateSubmitted || ''; break;
        default: aVal = a.dateSubmitted || ''; bVal = b.dateSubmitted || '';
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDirection]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-[#0037b0]" />
      : <ArrowDown className="w-3 h-3 text-[#0037b0]" />;
  };

  const formatDate = (d: any) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center">
          <div>
            <h3 className="font-sans font-bold text-gray-900">Legislative Archival Vault</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">Historical repository of delivered briefings and completed inquiries.</p>
          </div>
          <span className="text-xs text-gray-500 font-semibold">
            {isFiltered 
              ? `${filtered.length} of ${archived.length} entries` 
              : `${archived.length} total entries`}
          </span>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, title, or member name..."
              className="w-full pl-9 pr-8 py-1.5 border border-[#c4c5d7] rounded-md text-xs font-sans placeholder-gray-400 focus:outline-none focus:border-[#0037b0] focus:ring-1 focus:ring-[#0037b0] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative min-w-[150px]">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-gray-700 focus:outline-none focus:border-[#0037b0] appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                {statuses.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="relative min-w-[140px]">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-gray-700 focus:outline-none focus:border-[#0037b0] appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>

            {isFiltered && (
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory(''); setSelectedStatus(''); }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-[#ba1a1a]/40 hover:border-[#ba1a1a] text-[#ba1a1a] hover:bg-red-50/50 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f4f5]/50 border-b border-[#c4c5d7]">
                <th 
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort('id')}
                >
                  <span className="flex items-center gap-1">Request ID {getSortIcon('id')}</span>
                </th>
                <th 
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort('title')}
                >
                  <span className="flex items-center gap-1">Title {getSortIcon('title')}</span>
                </th>
                <th 
                  className="hidden md:table-cell px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort('member')}
                >
                  <span className="flex items-center gap-1">Member {getSortIcon('member')}</span>
                </th>
                <th 
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort('status')}
                >
                  <span className="flex items-center gap-1">Status {getSortIcon('status')}</span>
                </th>
                <th 
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort('dateSubmitted')}
                >
                  <span className="flex items-center gap-1">Date {getSortIcon('dateSubmitted')}</span>
                </th>
                <th className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <Database className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs text-gray-400 italic">Loading archive...</p>
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <Filter className="w-8 h-8 text-gray-400 animate-pulse" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-gray-900">No archived records match your criteria</h5>
                        <p className="text-[10px] text-gray-500 max-w-sm">Try modifying your search text, selecting a different status, or clearing the active filters.</p>
                      </div>
                      <button
                        onClick={() => { setSearchQuery(''); setSelectedCategory(''); setSelectedStatus(''); }}
                        className="px-3 py-1.5 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm transition-all cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : paginated.map((r: any) => {
                const displayId = r.requestNumber || r.id;
                const memberName = r.submitter ? `${r.submitter.firstName} ${r.submitter.lastName}` : '';
                const catName = r.category?.name || r.category || '';
                return (
                  <tr 
                    key={r.id} 
                    className="hover:bg-[#f3f4f5]/40 transition-colors group cursor-pointer"
                    onClick={() => setViewRequest(r)}
                  >
                    <td className="px-4 lg:px-6 py-4">
                      <span className="bg-[#dce1ff] text-[#0039b5] text-[10px] font-bold px-2 py-0.5 rounded font-sans">
                        {displayId}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="max-w-[320px]">
                        <p className="font-semibold text-sm text-[#191c1d] truncate group-hover:text-[#0037b0] transition-colors">
                          {r.title}
                        </p>
                        {catName && <p className="text-xs text-gray-500 truncate">{catName}</p>}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 lg:px-6 py-4 text-sm text-[#191c1d]">
                      {memberName ? honourable(memberName) : '—'}
                    </td>
                    <td className="px-4 lg:px-6 py-4">{getStatusBadge(r.status)}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-[#191c1d] font-semibold">
                      {formatDate(r.dateSubmitted)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-right">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setViewRequest(r); }}
                        className="p-1.5 text-[#0037b0] hover:bg-blue-50 rounded transition-all cursor-pointer"
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sorted.length}
          onPageChange={setCurrentPage}
          label="entries"
          trailing={
            isFiltered && (
              <span className="text-gray-400 ml-1">
                (filtered from {archived.length})
              </span>
            )
          }
        />
      </div>

      {/* View Detail Modal */}
      {viewRequest && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setViewRequest(null)}
        >
          <div 
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-[#dce1ff] text-[#0039b5] text-xs font-bold px-2.5 py-1 rounded">
                  {viewRequest.requestNumber || viewRequest.id}
                </span>
                <div>
                  <h3 className="font-sans font-bold text-gray-900 text-sm">{viewRequest.title}</h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">{viewRequest.category?.name || viewRequest.category || ''}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewRequest(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3 flex-wrap">
                {viewRequest.status === 'APPROVED' && (
                  <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Approved</span>
                )}
                {viewRequest.status === 'DELIVERED' && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Delivered</span>
                )}
                {viewRequest.status === 'CLOSED' && (
                  <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Closed</span>
                )}
                {viewRequest.priority === 'URGENT' && (
                  <span className="bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider">
                    Urgent Priority
                  </span>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Member (MP)</span>
                  <p className="text-sm font-semibold text-[#191c1d]">
                    {viewRequest.submitter ? honourable(`${viewRequest.submitter.firstName} ${viewRequest.submitter.lastName}`) : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assigned Officer</span>
                  {viewRequest.officer ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[9px] font-bold text-[#001551]">
                        {viewRequest.officer.firstName?.[0]}{viewRequest.officer.lastName?.[0]}
                      </div>
                      <p className="text-sm font-semibold text-[#191c1d]">{viewRequest.officer.firstName} {viewRequest.officer.lastName}</p>
                    </div>
                  ) : viewRequest.team?.name ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[9px] font-bold text-[#001551]">
                        {viewRequest.team.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold text-[#191c1d]">{viewRequest.team.name}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Unassigned</p>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date Submitted</span>
                  <p className="text-sm font-semibold text-[#191c1d]">
                    {viewRequest.dateSubmitted ? formatDate(viewRequest.dateSubmitted) : '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Deadline</span>
                  <p className="text-sm font-semibold text-[#191c1d]">
                    {viewRequest.deadline ? formatDate(viewRequest.deadline) : '—'}
                  </p>
                </div>
              </div>

              {/* Description */}
              {viewRequest.description && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</span>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100">
                    {viewRequest.description}
                  </p>
                </div>
              )}

              {/* Attachments */}
              {viewRequest.attachments && viewRequest.attachments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Attached Files ({viewRequest.attachments.length})
                  </span>
                  <div className="space-y-1.5">
                    {viewRequest.attachments.map((att: any, idx: number) => (
                      <div 
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/50 rounded text-xs transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                          <span className="font-medium truncate text-gray-700">{att.name}</span>
                        </div>
                        {att.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadFile(att.id, att.name).catch(() =>
                                toast.error(`Failed to download "${att.name}"`)
                              );
                            }}
                            className="text-[10px] text-[#0037b0] font-bold hover:underline shrink-0 ml-2"
                          >
                            Download
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-between items-center shrink-0">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Archived Record
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewRequest(null)}
                  className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold py-1.5 px-4 rounded transition-all cursor-pointer"
                >
                  Close
                </button>
                {(currentUser.role === "ADMIN" || currentUser.role === "MP") && (
                  <button
                    onClick={() => {
                      setViewRequest(null);
                      onNavigate('briefs', viewRequest.id);
                    }}
                    className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-bold py-1.5 px-4 rounded transition-all cursor-pointer"
                  >
                    Open Full Brief
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
