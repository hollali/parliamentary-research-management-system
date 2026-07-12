import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { getCommitteeStats, getRequestsByCommittee, shareWithCommittee } from '../lib/api';
import type { Committee } from '../types';
import { 
  Users, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  BarChart3,
  Share2,
  X
} from 'lucide-react';

interface CommitteeWorkbenchViewProps {
  onNavigate: (view: string, id?: string) => void;
}

interface CommitteeWithStats extends Committee {
  total: number;
  statuses: Record<string, number>;
}

export const CommitteeWorkbenchView: React.FC<CommitteeWorkbenchViewProps> = ({ onNavigate }) => {
  const { requests } = useApp();
  const { toast } = useToast();
  const [committees, setCommittees] = useState<CommitteeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommittee, setSelectedCommittee] = useState<CommitteeWithStats | null>(null);
  const [committeeRequests, setCommitteeRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetCommittee, setShareTargetCommittee] = useState('');
  const [shareNotes, setShareNotes] = useState('');
  const [sharingRequestId, setSharingRequestId] = useState('');
  const [submittingShare, setSubmittingShare] = useState(false);
  const currentCommitteeId = selectedCommittee?.id ?? '';

  useEffect(() => {
    getCommitteeStats()
      .then((data) => {
        if (Array.isArray(data)) setCommittees(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelectCommittee = async (committee: CommitteeWithStats) => {
    setSelectedCommittee(committee);
    setLoadingRequests(true);
    try {
      const data = await getRequestsByCommittee(committee.id);
      if (Array.isArray(data)) setCommitteeRequests(data);
    } catch {
      toast.error('Failed to load committee requests');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleShare = async () => {
    if (!shareTargetCommittee || !sharingRequestId) return;
    setSubmittingShare(true);
    try {
      await shareWithCommittee(sharingRequestId, shareTargetCommittee, shareNotes || undefined);
      toast.success('Request shared successfully');
      setShareModalOpen(false);
      setShareTargetCommittee('');
      setShareNotes('');
      setSharingRequestId('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to share request');
    } finally {
      setSubmittingShare(false);
    }
  };

  const openShareModal = (requestId: string) => {
    setSharingRequestId(requestId);
    setShareTargetCommittee('');
    setShareNotes('');
    setShareModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': case 'APPROVED': return 'text-emerald-700 bg-emerald-50';
      case 'IN_PROGRESS': case 'ASSIGNED': return 'text-blue-700 bg-blue-50';
      case 'REVISION_REQUESTED': return 'text-amber-700 bg-amber-50';
      case 'OVERDUE': return 'text-red-700 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (selectedCommittee) {
    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedCommittee(null)}
            className="text-[#0037b0] hover:underline text-xs font-bold"
          >
            All Committees
          </button>
          <ChevronRight className="w-3 h-3 text-gray-400" />
          <h2 className="font-sans font-bold text-xl text-[#191c1d]">{selectedCommittee.name}</h2>
        </div>

        {/* Committee Info */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Committee Type</p>
              <p className="text-xs font-bold text-gray-900 mt-1">{selectedCommittee.committeeType}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Chairperson</p>
              <p className="text-xs font-bold text-gray-900 mt-1">{selectedCommittee.chairperson || 'Not assigned'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Clerk</p>
              <p className="text-xs font-bold text-gray-900 mt-1">{selectedCommittee.clerk || 'Not assigned'}</p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm text-center">
            <span className="text-2xl font-bold text-gray-900">{selectedCommittee.total}</span>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Total Requests</p>
          </div>
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm text-center">
            <span className="text-2xl font-bold text-[#0037b0]">{(selectedCommittee.statuses['IN_PROGRESS'] || 0) + (selectedCommittee.statuses['ASSIGNED'] || 0)}</span>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Active</p>
          </div>
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm text-center">
            <span className="text-2xl font-bold text-emerald-700">{selectedCommittee.statuses['APPROVED'] || 0}</span>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">Approved</p>
          </div>
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm text-center">
            <span className="text-2xl font-bold text-amber-700">{selectedCommittee.statuses['REVISION_REQUESTED'] || 0}</span>
            <p className="text-[10px] text-gray-500 mt-1 uppercase font-semibold">In Revision</p>
          </div>
        </div>

        {/* Requests list */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
          <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7]">
            <h3 className="font-sans font-bold text-gray-900">Committee Requests</h3>
          </div>
          <div className="p-6">
            {loadingRequests ? (
              <p className="text-xs text-gray-400 italic">Loading requests...</p>
            ) : committeeRequests.length > 0 ? (
              <div className="space-y-3">
                {committeeRequests.map((r) => (
                  <div 
                    key={r.id} 
                    onClick={() => onNavigate('briefs', r.requestNumber || r.id)}
                    className="border border-[#c4c5d7] rounded-lg p-4 hover:border-[#0037b0] hover:bg-blue-50/10 cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#dce1ff] text-[#0039b5] text-[10px] font-bold px-2 py-0.5 rounded">{r.requestNumber || r.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(r.status)}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-900">{r.title}</h4>
                        <p className="text-[10px] text-gray-500">
                          Submitted by {r.submitter ? `${r.submitter.firstName} ${r.submitter.lastName}` : 'Unknown'} • 
                          {r.officer ? ` Assigned to ${r.officer.firstName} ${r.officer.lastName}` : ' Unassigned'}
                        </p>
                      </div>
                      <div className="text-right text-[10px] text-gray-400">
                        <p>{r.priority}</p>
                        <p>{r._count?.reports || 0} reports</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); openShareModal(r.id); }}
                          className="mt-1 text-[#0037b0] hover:underline flex items-center gap-1 ml-auto"
                          title="Share with another committee"
                        >
                          <Share2 className="w-3 h-3" /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-8">No requests for this committee</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Committee Workbench</h2>
        <p className="font-sans text-sm text-[#434655] mt-1">View and manage research requests by parliamentary committee.</p>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 italic">Loading committees...</p>
      ) : committees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {committees.map((c) => (
            <div 
              key={c.id}
              onClick={() => handleSelectCommittee(c)}
              className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm hover:border-[#0037b0] hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#0037b0] transition-colors">
                    {c.shortName ? `${c.shortName}` : c.name}
                  </h3>
                  {c.shortName && (
                    <p className="text-[10px] text-gray-500">{c.name}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {c.total} requests
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {c.committeeType}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#0037b0] transition-colors" />
              </div>

              {/* Mini status bars */}
              {c.total > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
                    {Object.entries(c.statuses).map(([status, count]) => {
                      const width = (count / c.total) * 100;
                      let color = 'bg-gray-300';
                      if (status === 'APPROVED') color = 'bg-emerald-500';
                      else if (status === 'IN_PROGRESS' || status === 'ASSIGNED') color = 'bg-blue-500';
                      else if (status === 'REVISION_REQUESTED') color = 'bg-amber-500';
                      return <div key={status} className={color} style={{ width: `${width}%` }} />;
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-12">No committees found</p>
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShareModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-sans font-bold text-base text-[#191c1d]">Share with Committee</h3>
              <button onClick={() => setShareModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Target Committee</label>
                <select
                  value={shareTargetCommittee}
                  onChange={(e) => setShareTargetCommittee(e.target.value)}
                  className="w-full mt-1 border border-[#c4c5d7] rounded-md px-3 py-2 text-xs font-semibold text-gray-700"
                >
                  <option value="">Select a committee...</option>
                  {(committees as CommitteeWithStats[]).map((c) => {
                    if (currentCommitteeId && c.id === currentCommitteeId) return null;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.shortName || c.name} — {c.name}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Notes (Optional)</label>
                <textarea
                  value={shareNotes}
                  onChange={(e) => setShareNotes(e.target.value)}
                  rows={3}
                  placeholder="Why is this being shared..."
                  className="w-full mt-1 border border-[#c4c5d7] rounded-md px-3 py-2 text-xs text-gray-700 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                disabled={!shareTargetCommittee || submittingShare}
                className="px-4 py-2 bg-[#0037b0] text-white text-xs font-bold rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submittingShare ? 'Sharing...' : 'Share Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
