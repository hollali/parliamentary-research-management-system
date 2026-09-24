import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { honourable } from '../lib/format';
import { Pagination } from './Pagination';
import {
  FileText,
  Eye,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Users,
  Calendar,
  LayoutGrid,
  List as ListIcon,
  MessageSquare,
  FileCheck2,
  Flag,
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

interface PipelineColumn {
  key: string;
  label: string;
  hint: string;
  values: string[];
  dotClass: string;
  headerBg: string;
  accent: string;
  attention?: boolean;
}

const PIPELINE: PipelineColumn[] = [
  { key: 'preparation', label: 'In Preparation', hint: 'Requested or being researched', values: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS'], dotClass: 'bg-[#0037b0]', headerBg: 'bg-[#dce1ff]/60', accent: 'text-[#0037b0]' },
  { key: 'awaiting-review', label: 'Awaiting Review', hint: 'Draft in — action required', values: ['DRAFT_SUBMITTED', 'REVISION_REQUESTED', 'REVISED'], dotClass: 'bg-amber-500', headerBg: 'bg-amber-50', accent: 'text-amber-700', attention: true },
  { key: 'approved', label: 'Approved', hint: 'Brief approved', values: ['APPROVED'], dotClass: 'bg-green-600', headerBg: 'bg-green-50', accent: 'text-green-700' },
  { key: 'delivered', label: 'Delivered', hint: 'Sent to member', values: ['DELIVERED'], dotClass: 'bg-emerald-600', headerBg: 'bg-emerald-50', accent: 'text-emerald-700' },
  { key: 'closed', label: 'Closed', hint: 'Matter concluded', values: ['CLOSED'], dotClass: 'bg-gray-400', headerBg: 'bg-gray-100', accent: 'text-gray-500' },
];

type ViewMode = 'board' | 'list';

interface LegislativeBriefsViewProps {
  onNavigate: (view: string, id?: string) => void;
}

export const LegislativeBriefsView: React.FC<LegislativeBriefsViewProps> = ({ onNavigate }) => {
  const { requests } = useApp();
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [statusGroup, setStatusGroup] = useState(0);
  const [sortField, setSortField] = useState<'dateSubmitted' | 'deadline' | 'title' | 'status'>('dateSubmitted');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const isPastDeadline = (r: typeof requests[0]) => {
    if (r.status === 'OVERDUE') return true;
    const t = r.deadline ? new Date(r.deadline).getTime() : NaN;
    return !Number.isNaN(t) && t < Date.now();
  };

  const filtered = useMemo(() => {
    let list = [...requests];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.member.toLowerCase().includes(q) ||
          r.assignedOfficerName?.toLowerCase().includes(q) ||
          (r.teamName || '').toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [requests, search]);

  const boardColumn = (r: typeof requests[0]) => {
    if (r.status === 'OVERDUE') return 'overdue';
    const col = PIPELINE.find((c) => c.values.includes(r.status));
    return col ? col.key : 'closed';
  };

  const boardCards = useMemo(() => {
    const groups: Record<string, typeof requests> = { overdue: [], ...Object.fromEntries(PIPELINE.map((c) => [c.key, []])) };
    filtered.forEach((r) => groups[boardColumn(r)].push(r));
    return groups;
  }, [filtered]);

  const awaitingReviewCount = boardCards['awaiting-review'].length;
  const overdueCount = boardCards['overdue'].length;

  const paginated = useMemo(() => {
    let list = [...filtered];
    const group = STATUS_GROUPS[statusGroup];
    if (group.values) list = list.filter((r) => group.values!.includes(r.status));
    if (['dateSubmitted', 'deadline', 'title', 'status'].includes(sortField)) {
      list.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'dateSubmitted') {
          cmp = new Date(a.dateSubmittedRaw || a.dateSubmitted || 0).getTime() - new Date(b.dateSubmittedRaw || b.dateSubmitted || 0).getTime();
        } else if (sortField === 'deadline') cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        else if (sortField === 'title') cmp = a.title.localeCompare(b.title);
        else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [filtered, statusGroup, sortField, sortDir]);

  const listViews = paginated.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(paginated.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusGroup, sortField, sortDir, view]);

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

  const renderCard = (req: typeof requests[0]) => {
    const overdue = isPastDeadline(req) && req.status !== 'OVERDUE';
    const unresolved = (req.comments || []).filter((c) => !c.resolved).length;
    const hasDraft = !!(req.content || req.reportId);

    return (
      <div
        key={req.id}
        onClick={() => onNavigate('briefs', req.id)}
        className={`group bg-white border rounded-lg p-3.5 shadow-sm hover:shadow-md hover:border-[#0037b0]/40 transition-all cursor-pointer ${overdue ? 'border-[#ba1a1a]/40' : 'border-[#e0e1e6]'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold text-gray-400 uppercase">{req.id.slice(0, 10)}</p>
            <p className="text-sm font-bold text-[#191c1d] leading-snug mt-0.5 line-clamp-2 group-hover:text-[#0037b0] transition-colors">
              {req.title}
            </p>
          </div>
          {req.priority === 'URGENT' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#ba1a1a] bg-[#ffdad6] px-1.5 py-0.5 rounded shrink-0">
              <Flag className="w-2.5 h-2.5 fill-[#ba1a1a]" /> Urgent
            </span>
          )}
        </div>

        <div className="space-y-1.5 mt-2.5">
          <div className="flex items-center gap-1.5 text-xs text-[#434655]">
            <Users className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{honourable(req.member)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#434655]">
            <span className="w-3 h-3 rounded-full bg-[#dce1ff] text-[#0037b0] text-[7px] font-bold flex items-center justify-center shrink-0">
              {(req.teamName || req.assignedOfficerName || '?').slice(0, 2).toUpperCase()}
            </span>
            <span className="truncate">
              {req.teamName || req.assignedOfficerName || <span className="text-gray-400 italic">Unassigned</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#f0f0f2]">
          <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-[#ba1a1a] font-bold' : 'text-[#434655]'}`}>
            <Calendar className="w-3 h-3 shrink-0" />
            {req.deadline ? new Date(req.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'No date'}
            {overdue && <AlertTriangle className="w-3 h-3 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5">
            {unresolved > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                <MessageSquare className="w-2.5 h-2.5" /> {unresolved}
              </span>
            )}
            {hasDraft ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#0037b0] bg-[#dce1ff] px-1.5 py-0.5 rounded-full" title={`v${req.draftVersion}.00`}>
                <FileCheck2 className="w-2.5 h-2.5" /> v{req.draftVersion}.00
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                <Clock className="w-2.5 h-2.5" /> No draft
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate('briefs', req.id); }}
              className="p-1.5 rounded-lg bg-[#0037b0] text-white hover:bg-[#1d4ed8] transition-colors shrink-0"
              title="Review brief"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOverdueColumn = () => {
    const cards = boardCards['overdue'];
    return (
      <div key="overdue" className="min-w-[290px] w-[290px] shrink-0">
        <div className="bg-[#fff5f4] border border-[#ba1a1a]/30 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-21rem)]">
          <div className="px-4 py-3 border-b border-[#ba1a1a]/20 bg-[#ffdad6]/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ba1a1a] animate-pulse" />
              <h3 className="text-xs font-bold text-[#93000a] uppercase tracking-wider">Overdue</h3>
              <span className="ml-auto text-[10px] font-bold bg-[#ba1a1a] text-white rounded-full px-1.5 py-0.5">{cards.length}</span>
            </div>
            <p className="text-[10px] text-[#93000a]/70 mt-1 font-medium">Past deadline — needs action</p>
          </div>
          <div className="p-2.5 space-y-2.5 overflow-y-auto">
            {cards.map(renderCard)}
            {cards.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-6 italic">Nothing overdue 🎉</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBoard = () => (
    <div>
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 mb-3 rounded-lg border border-[#ba1a1a]/30 bg-[#fff5f4] px-3.5 py-2 text-xs font-semibold text-[#93000a]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {overdueCount} brief{overdueCount > 1 ? 's are' : ' is'} overdue
          {awaitingReviewCount > 0 && (
            <span className="ml-auto text-[#0037b0] font-bold bg-white border border-[#c4c5d7] rounded-full px-2 py-0.5">
              {awaitingReviewCount} awaiting review
            </span>
          )}
        </div>
      )}
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {renderOverdueColumn()}
        {PIPELINE.map((col) => {
          const cards = boardCards[col.key];
          const isEmpty = cards.length === 0;
          return (
            <div key={col.key} className="min-w-[290px] w-[290px] shrink-0">
              <div className={`bg-[#f3f4f5] border border-[#c4c5d7] rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-21rem)]`}>
                <div className={`px-4 py-3 border-b border-[#c4c5d7] ${col.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0">
                      <span className={`block w-2 h-2 rounded-full ${col.dotClass}`} />
                    </span>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${col.accent}`}>{col.label}</h3>
                    <span className={`ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 ${col.attention && cards.length > 0 ? 'bg-amber-500 text-white' : 'bg-white text-gray-500 border border-[#c4c5d7]'}`}>
                      {cards.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 font-medium">{col.hint}</p>
                </div>
                <div className="p-2.5 space-y-2.5 overflow-y-auto">
                  {cards.map(renderCard)}
                  {isEmpty && (
                    <div className="text-center text-xs text-gray-400 py-6 italic">No briefs here</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderList = () => (
    <div className="bg-white border border-[#e0e1e6] rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#f9fafb] border-b border-[#e0e1e6]">
            <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Request</th>
            <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Member</th>
            <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</th>
            <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Research Topic</th>
            <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Deadline</th>
            <th className="text-right px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0f2]">
          {listViews.map((req) => (
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
                  {req.teamName || req.assignedOfficerName || <span className="text-gray-400 italic">Unassigned</span>}
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
                <div className={`flex items-center gap-1.5 text-sm ${isPastDeadline(req) ? 'text-[#ba1a1a] font-bold' : 'text-[#434655]'}`}>
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  {req.deadline ? new Date(req.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
                  {isPastDeadline(req) && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
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
          {paginated.length === 0 && (
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
        totalItems={paginated.length}
        onPageChange={setCurrentPage}
        label="briefs"
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">Research Briefs</h2>
          <p className="font-sans text-base text-[#434655] mt-1.5">
            Track every legislative brief through the research and review pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {view === 'board' && (
            <>
              {awaitingReviewCount > 0 && (
                <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> {awaitingReviewCount} need{awaitingReviewCount === 1 ? 's' : ''} review
                </span>
              )}
              {overdueCount > 0 && (
                <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-[#93000a] bg-[#ffdad6] border border-[#ba1a1a]/30 rounded-full px-3 py-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {overdueCount} overdue
                </span>
              )}
            </>
          )}
          <div className="flex rounded-xl overflow-hidden border border-[#c4c5d7] bg-white shadow-sm">
            <button
              onClick={() => setView('board')}
              className={`px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${view === 'board' ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-50'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 text-xs font-bold border-l border-[#c4c5d7] transition-all flex items-center gap-1.5 ${view === 'list' ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-50'}`}
            >
              <ListIcon className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, title, member, officer, or research topic..."
            className="w-full bg-white border border-[#c4c5d7] rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#0037b0] transition-colors"
          />
        </div>
        {view === 'list' && (
          <>
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-all flex items-center gap-2 ${
                showFilters ? 'bg-[#0037b0] text-white border-[#0037b0]' : 'bg-white text-[#434655] border-[#c4c5d7] hover:border-[#0037b0]'
              }`}
            >
              <Filter className="w-4 h-4" /> Sort
            </button>
          </>
        )}
      </div>

      {/* Sort options (list only) */}
      {view === 'list' && showFilters && (
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

      {view === 'board' ? renderBoard() : renderList()}
    </div>
  );
};