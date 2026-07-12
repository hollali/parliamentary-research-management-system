import React, { useState, useEffect } from 'react';
import { getAnalytics } from '../lib/api';
import { ExportButton } from './ExportButton';
import { BarChart3, TrendingUp, Users, FileText } from 'lucide-react';

export const StatisticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then((data) => {
        setAnalytics(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const totalRequests = analytics?.requestsByStatus?.reduce((sum: number, s: any) => sum + s._count, 0) || 0;
  const completedRequests = analytics?.requestsByStatus?.filter((s: any) => ['APPROVED', 'DELIVERED', 'CLOSED'].includes(s.status)).reduce((sum: number, s: any) => sum + s._count, 0) || 0;
  const officersCount = analytics?.officersWorkload?.length || 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-[#0037b0]" />
            <h3 className="text-xl font-sans font-bold text-gray-900">Legislative Intelligence Statistics</h3>
          </div>
          {analytics && (
            <ExportButton
              data={[
                ...(analytics.requestsByStatus || []).map((s: any) => ({ type: 'Status', category: s.status.replace('_', ' '), count: s._count })),
                ...(analytics.officersWorkload || []).map((o: any) => ({ type: 'Officer', category: `${o.firstName} ${o.lastName}`, count: o._count.assignedRequests })),
              ]}
              columns={[
                { key: 'type', label: 'Category Type' },
                { key: 'category', label: 'Category' },
                { key: 'count', label: 'Count' },
              ]}
              filename="parliament_statistics"
              title="Parliamentary Research Statistics"
            />
          )}
        </div>

        {loading ? (
          <p className="text-xs text-gray-400 italic">Loading analytics...</p>
        ) : analytics ? (
          <div className="space-y-8">
            {/* Summary metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 border border-gray-100 rounded">
                <span className="text-2xl font-bold text-gray-900">{totalRequests}</span>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Total Requests</p>
              </div>
              <div className="bg-gray-50 p-4 border border-gray-100 rounded">
                <span className="text-2xl font-bold text-[#0037b0]">{completedRequests}</span>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Completed</p>
              </div>
              <div className="bg-gray-50 p-4 border border-gray-100 rounded">
                <span className="text-2xl font-bold text-gray-900">{officersCount}</span>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Active Officers</p>
              </div>
              <div className="bg-gray-50 p-4 border border-gray-100 rounded">
                <span className="text-2xl font-bold text-[#006b2c]">{analytics.newRequestsLast30Days}</span>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">New (30 days)</p>
              </div>
            </div>

            {/* Requests by status */}
            {analytics.requestsByStatus?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Requests by Status</h4>
                <div className="space-y-2">
                  {analytics.requestsByStatus.map((s: any) => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-700 w-40">{s.status.replace('_', ' ')}</span>
                      <div className="flex-1 bg-gray-100 h-4 rounded overflow-hidden">
                        <div
                          className="bg-[#0037b0] h-full"
                          style={{ width: `${totalRequests > 0 ? (s._count / totalRequests) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-8 text-right">{s._count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Officer workload */}
            {analytics.officersWorkload?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Officer Workload</h4>
                <div className="space-y-2">
                  {analytics.officersWorkload.map((o: any) => (
                    <div key={o.id} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-700 w-40">{o.firstName} {o.lastName}</span>
                      <div className="flex-1 bg-gray-100 h-4 rounded overflow-hidden">
                        <div
                          className="bg-[#006b2c] h-full"
                          style={{ width: `${Math.min((o._count.assignedRequests / 10) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-600 w-16 text-right">{o._count.assignedRequests}/10</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">No analytics data available</p>
        )}
      </div>
    </div>
  );
};
