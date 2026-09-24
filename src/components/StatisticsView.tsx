import React, { useState, useEffect, useCallback } from 'react';
import { getAnalytics } from '../lib/api';
import { formatRequestStatus } from '../lib/status';
import { ExportButton } from './ExportButton';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Loader2,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

const STATUS_HEX: Record<string, string> = {
  SUBMITTED: '#64748b',
  ASSIGNED: '#0037b0',
  IN_PROGRESS: '#0e7490',
  DRAFT_SUBMITTED: '#7c3aed',
  REVISION_REQUESTED: '#b45309',
  REVISED: '#6366f1',
  APPROVED: '#15803d',
  DELIVERED: '#0d9488',
  CLOSED: '#475569',
};

const STATUS_ORDER = [
  'SUBMITTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'DRAFT_SUBMITTED',
  'REVISION_REQUESTED',
  'REVISED',
  'APPROVED',
  'DELIVERED',
  'CLOSED',
];

const COMPLETED = ['APPROVED', 'DELIVERED', 'CLOSED'];
const ACTIVE = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'DRAFT_SUBMITTED', 'REVISION_REQUESTED', 'REVISED'];

export const StatisticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getAnalytics()
      .then((data) => {
        setAnalytics(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
        console.warn('Failed to load analytics');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byStatus: any[] = [...(analytics?.requestsByStatus || [])]
    .sort((a, b) => {
      const ia = STATUS_ORDER.indexOf(a.status);
      const ib = STATUS_ORDER.indexOf(b.status);
      return (ia === -1 ? STATUS_ORDER.length : ia) - (ib === -1 ? STATUS_ORDER.length : ib);
    });

  const totalRequests =
    analytics?.totalRequests ?? byStatus.reduce((sum: number, s: any) => sum + s._count, 0);
  const completedRequests =
    analytics?.completedRequests ??
    byStatus.filter((s: any) => COMPLETED.includes(s.status)).reduce((sum: number, s: any) => sum + s._count, 0);
  const activeRequests =
    analytics?.activeRequests ??
    byStatus.filter((s: any) => ACTIVE.includes(s.status)).reduce((sum: number, s: any) => sum + s._count, 0);
  const overdueRequests = analytics?.overdueRequests ?? 0;
  const new30 = analytics?.newRequestsLast30Days ?? 0;
  const new7 = analytics?.newRequestsLast7Days ?? 0;
  const completionRate = analytics?.completionRate ?? (totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0);
  const avgDays = analytics?.avgCompletionDays ?? 0;

  const byCategory: any[] = [...(analytics?.requestsByCategory || [])].sort(
    (a, b) => (b.count || 0) - (a.count || 0),
  );
  const maxCategoryCount = byCategory.reduce((max, c) => Math.max(max, c.count || 0), 1);

  const byPriority: any[] = analytics?.requestsByPriority || [];
  const urgentCount = byPriority.find((p: any) => p.priority === 'URGENT')?._count ?? 0;
  const standardCount = byPriority.find((p: any) => p.priority === 'STANDARD')?._count ?? 0;

  const officers: any[] = analytics?.officersWorkload || [];
  const maxOfficerLoad = officers.reduce((max, o) => Math.max(max, o._count?.assignedRequests || 0), 1);

  const metricCards = [
    {
      label: 'Total Requests',
      value: totalRequests,
      icon: FileText,
      iconCls: 'bg-blue-50 text-[#0037b0]',
      valueCls: 'text-[#191c1d]',
      sub: `${new7} new in last 7 days`,
    },
    {
      label: 'Active Requestor',
      value: activeRequests,
      icon: Users,
      iconCls: 'bg-indigo-50 text-indigo-600',
      valueCls: 'text-indigo-700',
      sub: 'In the pipeline',
    },
    {
      label: 'Completed',
      value: completedRequests,
      icon: CheckCircle2,
      iconCls: 'bg-green-50 text-[#006b2c]',
      valueCls: 'text-[#006b2c]',
      sub: `${completionRate}% completion rate`,
    },
    {
      label: 'Overdue',
      value: overdueRequests,
      icon: AlertTriangle,
      iconCls: 'bg-red-50 text-[#ba1a1a]',
      valueCls: 'text-[#ba1a1a]',
      sub: overdueRequests > 0 ? 'Needs attention' : 'All on track',
    },
    {
      label: 'New This Month',
      value: new30,
      icon: TrendingUp,
      iconCls: 'bg-amber-50 text-amber-700',
      valueCls: 'text-[#191c1d]',
      sub: `${new7} within last 7 days`,
    },
    {
      label: 'Avg Completion',
      value: avgDays > 0 ? `${avgDays}d` : '—',
      icon: Clock,
      iconCls: 'bg-gray-100 text-gray-600',
      valueCls: 'text-[#191c1d]',
      sub: `Across ${completedRequests} delivered`,
    },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">
            Legislative Intelligence & Analytics
          </h2>
          <p className="font-sans text-sm text-[#434655] mt-1">
            Workflow performance, request distribution and directorate capacity.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="bg-white border border-[#c4c5d7] px-4 py-2 rounded font-sans text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh analytics"
          >
            <RefreshCw className={`w-4 h-4 text-[#747686] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <ExportButton
            data={[
              ...byStatus.map((s: any) => ({ type: 'Status', category: formatRequestStatus(s.status), count: s._count })),
              ...byPriority.map((p: any) => ({ type: 'Priority', category: p.priority, count: p._count })),
              ...byCategory.map((c: any) => ({ type: 'Category', category: c.name, count: c.count })),
              ...officers.map((o: any) => ({ type: 'Officer', category: `${o.firstName} ${o.lastName}`, count: o._count?.assignedRequests ?? 0 })),
              { type: 'Overall', category: 'Completion rate (%)', count: completionRate },
              { type: 'Overall', category: 'Avg completion (days)', count: avgDays },
            ]}
            columns={[
              { key: 'type', label: 'Category Type' },
              { key: 'category', label: 'Category' },
              { key: 'count', label: 'Count / Value' },
            ]}
            filename="parliament_statistics"
            title="Parliamentary Research Statistics"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-[#0037b0] animate-spin" />
          <p className="text-xs text-gray-400 italic">Compiling analytics…</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-16 text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-[#ba1a1a] mx-auto" />
          <p className="text-sm font-bold text-[#191c1d] mt-4">Could not load analytics</p>
          <p className="text-xs text-[#434655] mt-1">This report is only available to administrators.</p>
          <button
            onClick={load}
            className="mt-4 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {metricCards.map((m) => (
              <div
                key={m.label}
                className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm flex flex-col gap-3"
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.iconCls}`}>
                  <m.icon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${m.valueCls}`}>{m.value}</p>
                  <p className="text-[10px] font-bold text-[#747686] uppercase tracking-wider mt-0.5">
                    {m.label}
                  </p>
                  <p className="text-[10px] text-[#434655] mt-1">{m.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4.5 h-4.5 text-[#0037b0]" />
                  Requests by Status
                </h4>
                <span className="text-[10px] font-bold text-[#747686] uppercase tracking-wider">
                  {totalRequests} total
                </span>
              </div>

              {byStatus.length > 0 ? (
                <>
                  <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-50 border border-gray-100">
                    {byStatus.map((s: any) =>
                      s._count > 0 ? (
                        <div
                          key={s.status}
                          className="h-full transition-all"
                          style={{
                            width: `${(s._count / totalRequests) * 100}%`,
                            backgroundColor: STATUS_HEX[s.status] || '#9aa0b5',
                          }}
                          title={`${formatRequestStatus(s.status)} — ${s._count}`}
                        />
                      ) : null,
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                    {byStatus.map((s: any) => (
                      <div key={s.status} className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_HEX[s.status] || '#9aa0b5' }}
                        />
                        <span className="text-xs font-semibold text-[#434655] flex-1 truncate">
                          {formatRequestStatus(s.status)}
                        </span>
                        <span className="text-xs font-bold text-[#191c1d]">{s._count}</span>
                        <span className="text-[9px] font-bold text-[#747686] bg-gray-100 rounded-full px-1.5 py-0.5 w-11 text-center">
                          {totalRequests > 0 ? Math.round((s._count / totalRequests) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">No requests on record.</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
                <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-2">
                  <Flag className="w-4.5 h-4.5 text-[#ba1a1a]" />
                  Request Priority
                </h4>
                <div className="mt-4 flex h-3 w-full rounded-full overflow-hidden bg-gray-50 border border-gray-100">
                  {(urgentCount + standardCount) > 0 && (
                    <>
                      <div className="bg-[#ba1a1a] h-full" style={{ width: `${(urgentCount / (urgentCount + standardCount)) * 100}%` }} />
                      <div className="bg-[#0037b0] h-full flex-1" />
                    </>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#434655] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" /> Urgent
                    </span>
                    <span className="text-xs font-bold text-[#191c1d]">
                      {urgentCount}
                      <span className="text-[9px] font-bold text-[#747686] ml-1.5">
                        {urgentCount + standardCount > 0
                          ? Math.round((urgentCount / (urgentCount + standardCount)) * 100)
                          : 0}%
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#434655] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0037b0]" /> Standard
                    </span>
                    <span className="text-xs font-bold text-[#191c1d]">
                      {standardCount}
                      <span className="text-[9px] font-bold text-[#747686] ml-1.5">
                        {urgentCount + standardCount > 0
                          ? Math.round((standardCount / (urgentCount + standardCount)) * 100)
                          : 0}%
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
                <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-[#006b2c]" />
                  Submission Volume
                </h4>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-[#0037b0]">{new7}</p>
                    <p className="text-[9px] font-bold text-[#747686] uppercase tracking-wider mt-0.5">
                      Last 7 days
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                    <p className="text-xl font-bold text-[#191c1d]">{new30}</p>
                    <p className="text-[9px] font-bold text-[#747686] uppercase tracking-wider mt-0.5">
                      Last 30 days
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category + Officers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider">
                  Requests by Category
                </h4>
                <span className="text-[10px] font-bold text-[#747686] uppercase tracking-wider">
                  By committee
                </span>
              </div>
              {byCategory.length > 0 ? (
                <div className="space-y-3">
                  {byCategory.map((c: any) => (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-[10px] font-bold text-[#434655] truncate">{c.name}</span>
                        <span className="text-[10px] font-bold text-[#747686] shrink-0">
                          {c.count}
                          {totalRequests > 0 && (
                            <span className="ml-1.5 text-[#9aa0b5]">
                              {Math.round((c.count / totalRequests) * 100)}%
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0037b0] h-full rounded-full"
                          style={{ width: `${(c.count / Math.max(totalRequests, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No categories recorded.</p>
              )}
            </div>

            <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4.5 h-4.5 text-[#0037b0]" />
                  Officer Workload
                </h4>
                {officers.length > 0 && (
                  <span className="text-[10px] font-bold text-[#747686] uppercase tracking-wider">
                    {officers.length} active {officers.length === 1 ? 'officer' : 'officers'}
                  </span>
                )}
              </div>
              {officers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {officers.map((o: any) => {
                    const activeCount = o._count?.assignedRequests ?? 0;
                    const authored = o._count?.authoredReports ?? 0;
                    const pct = Math.min((activeCount / maxOfficerLoad) * 100, 100);
                    const overloaded = activeCount >= 7;
                    const busy = activeCount >= 4 && !overloaded;
                    const barColor = overloaded
                      ? 'bg-[#ba1a1a]'
                      : busy
                        ? 'bg-[#b45309]'
                        : 'bg-[#006b2c]';
                    return (
                      <div
                        key={o.id}
                        className="flex items-center gap-3 border border-[#e3e4ea] rounded-lg p-3"
                        title={`${o.firstName} ${o.lastName} — ${activeCount} active request${activeCount === 1 ? '' : 's'}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            overloaded
                              ? 'bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30'
                              : 'bg-blue-50 border border-blue-100 text-[#0037b0]'
                          }`}
                        >
                          {o.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#191c1d] truncate">
                              {o.firstName} {o.lastName}
                            </span>
                            <span
                              className={`text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0 ${
                                overloaded
                                  ? 'bg-[#ffdad6] text-[#93000a]'
                                  : busy
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-green-100 text-[#006b2c]'
                              }`}
                            >
                              {activeCount} active
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className={`${barColor} h-full rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[9px] font-semibold text-[#747686] mt-1">
                            {authored} report{authored === 1 ? '' : 's'} authored
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No active research officers.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-16 text-center shadow-sm">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-400 mt-4">No analytics data available yet.</p>
        </div>
      )}
    </div>
  );
};