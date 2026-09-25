import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getActivityLog } from '../lib/api';
import { InlineError } from './InlineError';
import { 
  History, 
  Filter, 
  ChevronDown,
  User,
  FileText,
  Bell,
  CheckCircle2,
  Upload,
  MessageSquare,
  LogIn,
  LogOut,
  ArrowLeftRight,
  X,
  RefreshCw,
  Users,
  ShieldAlert,
  TrendingUp,
  Loader2,
} from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  ASSIGNED: 'Assigned',
  REASSIGNED: 'Reassigned',
  STATUS_CHANGED: 'Status Changed',
  FILE_UPLOADED: 'File Uploaded',
  COMMENT_ADDED: 'Comment Added',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DEACTIVATED: 'Deactivated',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATED: <FileText className="w-3.5 h-3.5" />,
  UPDATED: <FileText className="w-3.5 h-3.5" />,
  ASSIGNED: <User className="w-3.5 h-3.5" />,
  REASSIGNED: <ArrowLeftRight className="w-3.5 h-3.5" />,
  STATUS_CHANGED: <CheckCircle2 className="w-3.5 h-3.5" />,
  FILE_UPLOADED: <Upload className="w-3.5 h-3.5" />,
  COMMENT_ADDED: <MessageSquare className="w-3.5 h-3.5" />,
  APPROVED: <CheckCircle2 className="w-3.5 h-3.5" />,
  DEACTIVATED: <ShieldAlert className="w-3.5 h-3.5" />,
  LOGIN: <LogIn className="w-3.5 h-3.5" />,
  LOGOUT: <LogOut className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-700',
  UPDATED: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  REASSIGNED: 'bg-fuchsia-100 text-fuchsia-700',
  STATUS_CHANGED: 'bg-amber-100 text-amber-700',
  FILE_UPLOADED: 'bg-emerald-100 text-emerald-700',
  COMMENT_ADDED: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  DEACTIVATED: 'bg-red-100 text-red-700',
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
};

const ENTITY_COLORS: Record<string, string> = {
  ResearchRequest: 'bg-blue-50 text-blue-700',
  User: 'bg-slate-100 text-slate-700',
  Attachment: 'bg-emerald-50 text-emerald-700',
  ResearchTeam: 'bg-violet-50 text-violet-700',
  Report: 'bg-amber-50 text-amber-700',
  ReviewComment: 'bg-purple-50 text-purple-700',
  Assignment: 'bg-indigo-50 text-indigo-700',
};

const FIELD_LABELS: Record<string, string> = {
  priority: 'Priority',
  deadline: 'Deadline',
  category: 'Category',
  subject: 'Subject',
  description: 'Description',
  title: 'Title',
  status: 'Status',
  assignedOfficerId: 'Officer',
  teamId: 'Team',
  titleId: 'Title',
  content: 'Content',
};

const renderMetadata = (log: any): string | null => {
  if (!log.metadata || typeof log.metadata !== 'object') return null;
  const m = log.metadata;
  if (m.changes && typeof m.changes === 'object') {
    const keys = Object.keys(m.changes).filter((k) => m.changes[k] !== undefined);
    if (keys.length === 0) return 'Details updated';
    return keys.length <= 3
      ? `Changed: ${keys.map((k) => FIELD_LABELS[k] || k).join(', ')}`
      : `Changed ${keys.length} fields: ${keys.slice(0, 3).map((k) => FIELD_LABELS[k] || k).join(', ')}…`;
  }
  if (m.previousOfficerId || m.newOfficerId) return 'Task reassigned to another officer';
  if (m.newTeamId) return 'Team assignment updated';
  const flat = Object.keys(m);
  if (flat.length === 0) return null;
  if (flat.length <= 2) return flat.map((k) => `${FIELD_LABELS[k] || k}: ${String(m[k]).slice(0, 40)}`).join(' · ');
  return `${flat.map((k) => FIELD_LABELS[k] || k).join(', ')}`;
};

const shortId = (id: string) => (id.length > 8 ? `#${id.slice(0, 8)}` : `#${id}`);

export const ActivityLogView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [summary, setSummary] = useState<{ today: number; uniqueActors: number; actions: { action: string; count: number }[] }>({ today: 0, uniqueActors: 0, actions: [] });
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActivityLog({
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        page,
        limit: perPage,
      });
      if (data?.logs) {
        setLogs(data.logs);
        setTotal(data.total);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      setError('Unable to load activity log entries. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, actionFilter, entityFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const topAction = useMemo(() => {
    if (summary.actions.length === 0) return null;
    return summary.actions[0];
  }, [summary.actions]);

  const goTo = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }, [page, totalPages]);

  const rangeStart = (page - 1) * perPage + 1;
  const rangeEnd = Math.min(total, page * perPage);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">Activity Audit Log</h2>
          <p className="font-sans text-sm text-[#434655] mt-1.5">Track all system activity across users, requests, and teams.</p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-[#c4c5d7] text-[#191c1d] text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm hover:border-[#0037b0] hover:text-[#0037b0] disabled:opacity-50 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#c4c5d7] rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-blue-50 text-[#0037b0]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#191c1d] leading-tight">{summary.today}</p>
            <p className="text-xs text-[#747686] font-semibold">Actions today</p>
          </div>
        </div>
        <div className="bg-white border border-[#c4c5d7] rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#191c1d] leading-tight">{summary.uniqueActors}</p>
            <p className="text-xs text-[#747686] font-semibold">Active users</p>
          </div>
        </div>
        <div className="bg-white border border-[#c4c5d7] rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[#191c1d] leading-tight truncate">{topAction ? ACTION_LABELS[topAction.action] || topAction.action : '—'}</p>
            <p className="text-xs text-[#747686] font-semibold">Most common action ({topAction?.count ?? 0}×)</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500 uppercase">Filters:</span>
        </div>
        <div className="relative">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-semibold text-gray-700 appearance-none cursor-pointer"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
            className="bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-semibold text-gray-700 appearance-none cursor-pointer"
          >
            <option value="">All Entities</option>
            <option value="ResearchRequest">Research Request</option>
            <option value="Report">Report</option>
            <option value="Attachment">Attachment</option>
            <option value="User">User</option>
            <option value="Assignment">Assignment</option>
            <option value="ResearchTeam">Research Team</option>
            <option value="ReviewComment">Review Comment</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        {(actionFilter || entityFilter) && (
          <button
            onClick={() => { setActionFilter(''); setEntityFilter(''); setPage(1); }}
            className="text-[10px] font-bold text-[#ba1a1a] hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">{total} total entries</span>
      </div>

      {/* Log entries */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Loader2 className="w-6 h-6 text-[#0037b0] animate-spin" />
            <p className="text-xs text-gray-400 font-semibold mt-2.5">Loading activity log...</p>
          </div>
        ) : error ? (
          <div className="p-4">
            <InlineError message={error} onRetry={fetchLogs} />
          </div>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={`p-2 rounded-full shrink-0 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                  {ACTION_ICONS[log.action] || <History className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900">
                    <span className="font-bold">
                      {log.author ? `${log.author.firstName} ${log.author.lastName}` : 'System'}
                    </span>
                    {' '}
                    <span className="text-gray-500">{log.description}</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    <span className="text-[10px] text-gray-400">
                      {new Date(log.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ENTITY_COLORS[log.entityType] || 'bg-gray-100 text-gray-500'}`}>
                      {log.entityType.replace(/([a-z])([A-Z])/g, '$1 $2')} {shortId(log.entityId)}
                    </span>
                    {renderMetadata(log) && (
                      <span className="text-[10px] text-[#747686] bg-[#f3f4f5] px-1.5 py-0.5 rounded max-w-full truncate" title={renderMetadata(log) || ''}>
                        {renderMetadata(log)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-semibold">No activity log entries found</p>
            <p className="text-xs mt-1">Try widening your filters.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] text-gray-400">
              {rangeStart}–{rangeEnd} of {total}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goTo(page - 1)}
                disabled={page === 1}
                className="text-[10px] font-bold text-[#0037b0] disabled:text-gray-300 disabled:cursor-default px-2 py-1"
              >
                Prev
              </button>
              {page > 3 && (
                <>
                  <button onClick={() => goTo(1)} className={`w-7 h-7 text-[10px] font-bold rounded-md ${page === 1 ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-100'}`}>1</button>
                  <span className="text-[10px] text-gray-400">…</span>
                </>
              )}
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => goTo(n)}
                  className={`w-7 h-7 text-[10px] font-bold rounded-md ${n === page ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-100'}`}
                >
                  {n}
                </button>
              ))}
              {page < totalPages - 2 && (
                <>
                  <span className="text-[10px] text-gray-400">…</span>
                  <button onClick={() => goTo(totalPages)} className="w-7 h-7 text-[10px] font-bold rounded-md text-[#434655] hover:bg-gray-100">{totalPages}</button>
                </>
              )}
              <button
                onClick={() => goTo(page + 1)}
                disabled={page === totalPages}
                className="text-[10px] font-bold text-[#0037b0] disabled:text-gray-300 disabled:cursor-default px-2 py-1"
              >
                Next
              </button>
              <div className="relative ml-2">
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                  className="bg-white border border-[#c4c5d7] rounded-md pl-2 pr-6 py-1 text-[10px] font-semibold text-gray-700 appearance-none cursor-pointer"
                  title="Rows per page"
                >
                  <option value={30}>30 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
