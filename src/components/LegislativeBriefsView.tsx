import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Pagination } from './Pagination';
import {
  FileText,
  Eye,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Calendar,
  Download,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  DRAFT_SUBMITTED: 'Draft Submitted',
  REVISION_REQUESTED: 'Revision Requested',
  REVISED: 'Revised',
  APPROVED: 'Approved',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
  OVERDUE: 'Overdue',
};

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-blue-50 text-[#0037b0]',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  DRAFT_SUBMITTED: 'bg-purple-50 text-purple-700',
  REVISION_REQUESTED: 'bg-orange-50 text-orange-700',
  REVISED: 'bg-teal-50 text-teal-700',
  APPROVED: 'bg-green-50 text-green-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-gray-100 text-gray-500',
  OVERDUE: 'bg-red-50 text-[#ba1a1a]',
};

const STATUS_GROUPS = [
  { label: 'All', values: null },
  { label: 'Active', values: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT_SUBMITTED', 'REVISION_REQUESTED', 'REVISED'] },
  { label: 'Completed', values: ['APPROVED', 'DELIVERED', 'CLOSED'] },
  { label: 'Overdue', values: ['OVERDUE'] },
];

interface LegislativeBriefsViewProps {
  onNavigate: (view: string, id?: string) => void;
}

export const LegislativeBriefsView: React.FC<LegislativeBriefsViewProps> = ({ onNavigate }) => {
  const { requests } = useApp();
  const [search, setSearch] = useState('');
  const [statusGroup, setStatusGroup] = useState(0);
  const [sortField, setSortField] = useState<'dateSubmitted' | 'deadline' | 'title' | 'status'>('dateSubmitted');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let list = [...requests];

    // Status group filter
    const group = STATUS_GROUPS[statusGroup];
    if (group.values) {
      list = list.filter((r) => group.values!.includes(r.status));
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.member.toLowerCase().includes(q) ||
          r.assignedOfficerName?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q),
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'dateSubmitted') {
        cmp = new Date(a.dateSubmittedRaw || a.dateSubmitted || 0).getTime() - new Date(b.dateSubmittedRaw || b.dateSubmitted || 0).getTime();
      } else if (sortField === 'deadline') cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      else if (sortField === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [requests, search, statusGroup, sortField, sortDir]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusGroup, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (currentPageClamped - 1) * pageSize,
    currentPageClamped * pageSize,
  );

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length, active: 0, completed: 0, overdue: 0 };
    requests.forEach((r) => {
      if (['OVERDUE'].includes(r.status)) c.overdue++;
      else if (['APPROVED', 'DELIVERED', 'CLOSED'].includes(r.status)) c.completed++;
      else c.active++;
    });
    return c;
  }, [requests]);

  const isOverdue = (r: typeof requests[0]) => r.status === 'OVERDUE' || new Date(r.deadline) < new Date();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">Legislative Briefs</h2>
          <p className="font-sans text-base text-[#434655] mt-1.5">
            All research requests and their brief status.
            <span className="text-gray-400 ml-1.5">({filtered.length} shown)</span>
          </p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_GROUPS.map((g, i) => (
          <button
            key={i}
            onClick={() => setStatusGroup(i)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              statusGroup === i
                ? 'bg-white text-[#191c1d] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {g.label}
            <span className="ml-1.5 text-xs font-semibold text-gray-400">
              {i === 0 ? counts.all : i === 1 ? counts.active : i === 2 ? counts.completed : counts.overdue}
            </span>
          </button>
        ))}
      </div>

      {/* Search & filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, title, member, officer, or category..."
            className="w-full bg-white border border-[#c4c5d7] rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#0037b0] transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${
            showFilters ? 'bg-[#0037b0] text-white border-[#0037b0]' : 'bg-white text-[#434655] border-[#c4c5d7] hover:border-[#0037b0]'
          }`}
        >
          <Filter className="w-4 h-4" /> Sort
        </button>
      </div>

      {/* Sort options */}
      {showFilters && (
        <div className="flex items-center gap-3 bg-white border border-[#e0e1e6] rounded-lg px-4 py-3">
          <span className="text-xs font-bold text-gray-400 uppercase">Sort by:</span>
          {(['dateSubmitted', 'deadline', 'title', 'status'] as const).map((f) => (
            <button
              key={f}
              onClick={() => toggleSort(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                sortField === f ? 'bg-[#0037b0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'dateSubmitted' ? 'Latest' : f.charAt(0).toUpperCase() + f.slice(1)}
              {sortField === f && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#e0e1e6] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#e0e1e6]">
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Request</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Deadline</th>
              <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f2]">
            {paginated.map((req) => (
              <tr
                key={req.id}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => onNavigate('briefs', req.id)}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-[#0037b0] shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#191c1d] truncate max-w-[240px]">{req.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">{req.id.slice(0, 8)}</p>
                    </div>
                    {req.priority === 'URGENT' && (
                      <span className="text-[10px] font-bold text-[#ba1a1a] bg-red-50 px-1.5 py-0.5 rounded shrink-0">URGENT</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm text-[#434655] truncate max-w-[140px]">{req.member}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-[#434655] truncate max-w-[140px] block">
                    {req.assignedOfficerName || <span className="text-gray-400 italic">Unassigned</span>}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${STATUS_COLORS[req.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-[#434655]">{req.category || '—'}</span>
                </td>
                <td className="px-5 py-4">
                  <div className={`flex items-center gap-1.5 text-sm ${isOverdue(req) ? 'text-[#ba1a1a] font-bold' : 'text-[#434655]'}`}>
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    {new Date(req.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {isOverdue(req) && <AlertTriangle className="w-3.5 h-3.5 text-[#ba1a1a] shrink-0" />}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate('briefs', req.id); }}
                      className="p-2 rounded-lg bg-[#0037b0] text-white hover:bg-[#1d4ed8] transition-colors"
                      title="Review brief"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-semibold">No briefs found</p>
                  <p className="text-xs mt-1">Try adjusting your search or filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPageClamped}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          label="briefs"
        />
      </div>
    </div>
  );
};
