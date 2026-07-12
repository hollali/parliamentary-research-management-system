import React, { useState, useEffect } from 'react';
import { getActivityLog } from '../lib/api';
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
  X
} from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  ASSIGNED: 'Assigned',
  STATUS_CHANGED: 'Status Changed',
  FILE_UPLOADED: 'File Uploaded',
  COMMENT_ADDED: 'Comment Added',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DEACTIVATED: 'Deactivated',
  LOGIN: 'Login',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATED: <FileText className="w-3.5 h-3.5" />,
  UPDATED: <FileText className="w-3.5 h-3.5" />,
  ASSIGNED: <User className="w-3.5 h-3.5" />,
  STATUS_CHANGED: <CheckCircle2 className="w-3.5 h-3.5" />,
  FILE_UPLOADED: <Upload className="w-3.5 h-3.5" />,
  COMMENT_ADDED: <MessageSquare className="w-3.5 h-3.5" />,
  APPROVED: <CheckCircle2 className="w-3.5 h-3.5" />,
  LOGIN: <LogIn className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATED: 'bg-blue-100 text-blue-700',
  UPDATED: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-indigo-100 text-indigo-700',
  STATUS_CHANGED: 'bg-amber-100 text-amber-700',
  FILE_UPLOADED: 'bg-emerald-100 text-emerald-700',
  COMMENT_ADDED: 'bg-purple-100 text-purple-700',
  APPROVED: 'bg-green-100 text-green-700',
  DEACTIVATED: 'bg-red-100 text-red-700',
  LOGIN: 'bg-slate-100 text-slate-700',
};

export const ActivityLogView: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getActivityLog({
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
        page,
        limit: 30,
      });
      if (data?.logs) {
        setLogs(data.logs);
        setTotal(data.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Activity Audit Log</h2>
        <p className="font-sans text-sm text-[#434655] mt-1">Track all system activity across users and requests.</p>
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
          <p className="text-xs text-gray-400 italic p-6 text-center">Loading activity log...</p>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={`p-1.5 rounded-full shrink-0 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                  {ACTION_ICONS[log.action] || <History className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-900">
                    <span className="font-bold">
                      {log.author ? `${log.author.firstName} ${log.author.lastName}` : 'System'}
                    </span>
                    {' '}
                    <span className="text-gray-500">{log.description}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-gray-400">
                      {new Date(log.createdAt).toLocaleString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-semibold">
                      {log.entityType}
                    </span>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                        {JSON.stringify(log.metadata)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-12">No activity log entries found</p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-[10px] font-bold text-[#0037b0] disabled:text-gray-300 disabled:cursor-default"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-[10px] font-bold text-[#0037b0] disabled:text-gray-300 disabled:cursor-default"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
