import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getOfficers } from '../lib/api';
import { ResearchRequest } from '../types';
import { 
  FileText, 
  TrendingUp, 
  Minus, 
  Check, 
  AlertTriangle, 
  Filter, 
  Download, 
  UserPlus, 
  Eye, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Activity,
  CheckCircle,
  MoreHorizontal,
  Flag
} from 'lucide-react';

interface AdminDashboardViewProps {
  onNavigate: (view: string, targetId?: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  const { requests, history, assignRequest, updateRequestStatus, updateRequestPriority } = useApp();
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING'>('ALL');
  const [showHighPriorityOnly, setShowHighPriorityOnly] = useState<boolean>(false);
  const [assigningRequestId, setAssigningRequestId] = useState<string | null>(null);
  const [officers, setOfficers] = useState<any[]>([]);

  useEffect(() => {
    getOfficers().then((data) => {
      if (Array.isArray(data)) setOfficers(data);
    }).catch(() => {});
  }, []);

  // Derive counts from requests state
  const totalPending = requests.filter(r => r.status === 'PENDING_REVIEW' || r.status === 'ASSIGNED').length;
  const totalAssigned = requests.filter(r => r.assignedOfficerId !== null).length;
  const inProgressCount = requests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'REVISION_IN_PROGRESS').length;
  const overdueCount = requests.filter(r => r.status === 'OVERDUE').length;

  // Filter requests for display
  const filteredRequests = requests.filter(req => {
    if (showHighPriorityOnly && req.priority !== 'URGENT') return false;
    if (filterTab === 'PENDING' && req.status !== 'PENDING_REVIEW') return false;
    return true;
  });

  const handleAssign = (requestId: string, officerId: string) => {
    assignRequest(requestId, [officerId]);
    setAssigningRequestId(null);
  };

  const getStatusBadge = (status: ResearchRequest['status']) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Pending Review</span>;
      case 'ASSIGNED':
        return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Assigned</span>;
      case 'IN_PROGRESS':
        return <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">In Progress</span>;
      case 'REVISION_REQUESTED':
      case 'REVISION_IN_PROGRESS':
        return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Revision</span>;
      case 'OVERDUE':
        return <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Overdue</span>;
      case 'COMPLETED':
        return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">Completed</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };
  const handleExportReport = () => {
    const csvContent = [
      ["Request ID", "Title", "Member", "Assigned Officer", "Status", "Deadline"],
      ...requests.map(req => [
        req.id,
        `"${req.title.replace(/"/g, '""')}"`,
        `"${req.member}"`,
        `"${req.assignedOfficerName || 'Unassigned'}"`,
        req.status,
        req.deadline
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Research_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Administrative Overview</h2>
          <p className="font-sans text-sm text-[#434655] mt-1">Real-time monitoring of legislative research workflow.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onNavigate('projects')}
            className="bg-white border border-[#c4c5d7] px-4 py-2 rounded font-sans text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
          >
            <Filter className="w-4 h-4 text-[#747686]" />
            <span>Filter View</span>
          </button>
          <button 
            onClick={handleExportReport}
            className="bg-white border border-[#c4c5d7] px-4 py-2 rounded font-sans text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#747686]" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Pending */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 hover:border-blue-500/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#d5e3fd] rounded text-[#001551]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Total Pending</p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">{totalPending}</h3>
          <p className="text-xs text-gray-500 mt-2 italic">Awaiting initial review</p>
        </div>

        {/* Assigned */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 hover:border-blue-500/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#dce1ff] rounded text-[#0039b5]">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Assigned</p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">{totalAssigned}</h3>
          <p className="text-xs text-gray-500 mt-2 italic">Active research in pipeline</p>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 hover:border-blue-500/40 transition-all shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#7ffc97]/20 rounded text-[#00501f]">
              <RefreshCw className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">In Progress</p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">{inProgressCount}</h3>
          <div className="w-full bg-[#edeeef] mt-3 h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#006b2c] h-full" style={{ width: `${totalAssigned > 0 ? Math.round((inProgressCount / totalAssigned) * 100) : 0}%` }}></div>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white border border-[#ba1a1a]/30 rounded-lg p-6 hover:border-[#ba1a1a]/50 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#ffdad6] rounded text-[#93000a]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[#ba1a1a] font-bold text-xs flex items-center bg-[#ffdad6] px-2 py-0.5 rounded gap-0.5">
              Critical <AlertTriangle className="w-3 h-3" />
            </span>
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Overdue</p>
          <h3 className="text-3xl font-bold text-[#ba1a1a] mt-1">{overdueCount < 10 ? `0${overdueCount}` : overdueCount}</h3>
          <p className="text-xs text-[#ba1a1a] mt-2 font-medium">Requires immediate action</p>
        </div>
      </div>

      {/* Request Management Table */}
      <section className="bg-white border border-[#c4c5d7] rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c5d7] flex flex-col md:flex-row justify-between items-start md:items-center bg-[#f3f4f5] gap-4">
          <h4 className="font-sans font-semibold text-[#191c1d]">Recent Research Requests</h4>
          <div className="flex items-center gap-4 flex-wrap w-full md:w-auto md:justify-end">
            {/* Elegant Priority Filter Toggle */}
            <div className="flex items-center gap-2 bg-white border border-[#c4c5d7] rounded px-3 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-[#434655] flex items-center gap-1 select-none">
                <Flag className="w-3.5 h-3.5 text-red-600 fill-red-600" />
                High Priority Only
              </span>
              <button
                type="button"
                onClick={() => setShowHighPriorityOnly(!showHighPriorityOnly)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showHighPriorityOnly ? 'bg-[#0037b0]' : 'bg-gray-200'
                }`}
                title="Toggle High Priority Filter"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showHighPriorityOnly ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex rounded overflow-hidden border border-[#c4c5d7] bg-white shadow-sm">
              <button 
                onClick={() => setFilterTab('ALL')}
                className={`px-4 py-1.5 text-xs font-bold transition-all ${
                  filterTab === 'ALL' ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-50'
                }`}
              >
                All Statuses
              </button>
              <button 
                onClick={() => setFilterTab('PENDING')}
                className={`px-4 py-1.5 text-xs font-bold border-l border-[#c4c5d7] transition-all ${
                  filterTab === 'PENDING' ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-50'
                }`}
              >
                Pending Review
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f4f5]/50 border-b border-[#c4c5d7]">
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">Request ID</th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">Title</th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">MP / RA</th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">Assigned Officer</th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">Deadline</th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRequests.map(req => (
                <tr 
                  key={req.id} 
                  className="hover:bg-[#f3f4f5]/40 transition-colors group cursor-pointer"
                  onClick={() => onNavigate('briefs', req.id)}
                >
                  {/* ID & Priority Flag */}
                  <td className="px-6 py-4 font-bold text-sm text-[#191c1d]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateRequestPriority(req.id, req.priority === 'URGENT' ? 'STANDARD' : 'URGENT')}
                        className="p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                        title={req.priority === 'URGENT' ? 'High Priority - Click to set Standard' : 'Standard Priority - Click to set High'}
                      >
                        <Flag 
                          className={`w-4 h-4 transition-all ${
                            req.priority === 'URGENT' 
                              ? 'text-red-600 fill-red-600 animate-pulse' 
                              : 'text-gray-300 hover:text-gray-500'
                          }`} 
                        />
                      </button>
                      <span className="cursor-pointer font-sans hover:text-[#0037b0] transition-colors" onClick={() => onNavigate('briefs', req.id)}>
                        {req.id}
                      </span>
                    </div>
                  </td>
                  
                  {/* Title and Category */}
                  <td className="px-6 py-4">
                    <div className="max-w-[280px]">
                      <p className="font-semibold text-sm text-[#191c1d] truncate group-hover:text-[#0037b0] transition-colors">
                        {req.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{req.category}</p>
                    </div>
                  </td>

                  {/* MP / Member */}
                  <td className="px-6 py-4 text-sm text-[#191c1d]">{req.member}</td>

                  {/* Assigned Officer */}
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    {req.assignedOfficerId ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#dce1ff] flex items-center justify-center text-[10px] font-bold text-[#001551]">
                          {req.assignedOfficerName?.split(' ').pop()?.slice(0, 2).toUpperCase() || 'RO'}
                        </div>
                        <span className="text-sm text-[#191c1d]">{req.assignedOfficerName}</span>
                      </div>
                    ) : (
                      <div>
                        {assigningRequestId === req.id ? (
                          <select 
                            onChange={(e) => handleAssign(req.id, e.target.value)}
                            className="text-xs p-1 border border-[#c4c5d7] rounded focus:ring-1 focus:ring-[#0037b0]"
                            defaultValue=""
                          >
                            <option value="" disabled>Choose staff...</option>
                            <option value="osei">Dr. David osei</option>
                            <option value="serwaa">Alice serwaa</option>
                            <option value="okyere">S. okyere</option>
                            <option value="mensah">Officer K. Mensah</option>
                          </select>
                        ) : (
                          <button 
                            onClick={() => setAssigningRequestId(req.id)}
                            className="text-[#ba1a1a] hover:text-[#ba1a1a]/80 font-semibold text-xs flex items-center gap-1 hover:underline"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Unassigned
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">{getStatusBadge(req.status)}</td>

                  {/* Deadline */}
                  <td className={`px-6 py-4 text-sm font-semibold ${req.status === 'OVERDUE' ? 'text-[#ba1a1a]' : 'text-[#191c1d]'}`}>
                    {req.deadline}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onNavigate('briefs', req.id)}
                        className="p-1.5 text-[#0037b0] hover:bg-blue-50 rounded transition-all" 
                        title="Review Progress"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setAssigningRequestId(req.id === assigningRequestId ? null : req.id)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-all"
                        title="Reassign Staff"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer paging controls */}
        <div className="px-6 py-4 bg-[#f3f4f5]/40 border-t border-[#c4c5d7] flex justify-between items-center text-sm text-[#434655]">
          <p>Showing {filteredRequests.length} of {requests.length} active requests</p>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-[#c4c5d7] rounded hover:bg-gray-50 transition-colors disabled:opacity-30" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="px-3 py-1 border border-[#c4c5d7] rounded hover:bg-gray-50 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Bottom Layout: Notifications Feed & Officer Capacity Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Directorate Activity log */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-sans font-bold text-[#191c1d] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#0037b0]" />
              Directorate Activity
            </h4>
            <button className="text-[#0037b0] text-sm font-semibold hover:underline">View Log</button>
          </div>
          <div className="space-y-6">
            {history.map((log) => (
              <div className="flex gap-4" key={log.id}>
                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                  log.type === 'alert' ? 'bg-[#ba1a1a]' : log.type === 'update' ? 'bg-[#0037b0]' : 'bg-[#515f74]'
                }`} />
                <div>
                  <p className="text-sm text-[#191c1d]">
                    <span className="font-bold">{log.userName}</span> {log.text}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {log.time} • <span className="italic">{log.sector}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assigned Staff Capacity directories */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-sans font-bold text-[#191c1d] mb-6">Officer Capacity</h4>
            <div className="space-y-5">
              {officers.length > 0 ? officers.map((officer: any) => {
                const activeCount = officer._count?.assignedRequests || 0;
                const maxCapacity = 10;
                const pct = Math.min((activeCount / maxCapacity) * 100, 100);
                const barColor = pct > 70 ? 'bg-[#ba1a1a]' : pct > 40 ? 'bg-[#0037b0]' : 'bg-[#006b2c]';
                return (
                  <div key={officer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-[#0037b0] text-xs">
                        {officer.initials}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#191c1d]">{officer.firstName} {officer.lastName}</p>
                        <p className="text-xs text-gray-500">Research Officer</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900">{activeCount}/{maxCapacity}</p>
                      <div className="w-20 bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className={`${barColor} h-full`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-xs text-gray-400 italic">No officers found</p>
              )}
            </div>
          </div>

          <button 
            onClick={() => onNavigate('members')}
            className="w-full mt-8 border border-[#0037b0] text-[#0037b0] font-semibold text-sm py-2.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
          >
            Manage Research Staff
          </button>
        </div>
      </div>
    </div>
  );
};
