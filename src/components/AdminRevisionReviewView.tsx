import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getRequest, getReviews } from '../lib/api';
import { ResearchRequest } from '../types';
import { 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  CornerDownRight, 
  Check, 
  Send, 
  AlertTriangle, 
  RotateCw,
  Clock,
  Sparkles,
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface AdminRevisionReviewViewProps {
  requestId: string;
  onBack: () => void;
}

interface ReviewComment {
  id: string;
  userName: string;
  userInitials: string;
  role: string;
  time: string;
  text: string;
  section?: string;
  resolved: boolean;
}

interface ReportData {
  id: string;
  content: string;
  title: string;
  version: number;
  isDraft: boolean;
  isApproved: boolean;
}

export const AdminRevisionReviewView: React.FC<AdminRevisionReviewViewProps> = ({ requestId, onBack }) => {
  const { requests, addComment, updateRequestStatus } = useApp();
  const [commentText, setCommentText] = useState('');
  const [selectedSection, setSelectedSection] = useState('Section: 1. Executive Summary');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);

  // Find request from context (already mapped)
  const request = requests.find(r => r.id === requestId) || requests[0];

  // Fetch report and reviews from API on mount
  useEffect(() => {
    if (!requestId) return;

    setLoading(true);

    // Fetch full request with reports
    getRequest(requestId)
      .then((data: any) => {
        if (data?.reports?.[0]) {
          setReport({
            id: data.reports[0].id,
            content: data.reports[0].content || '',
            title: data.reports[0].title || data.title,
            version: data.reports[0].version || 1,
            isDraft: data.reports[0].isDraft ?? true,
            isApproved: data.reports[0].isApproved ?? false,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        // Fall back to context data
        if (request?.content) {
          setReport({
            id: request.reportId || request.id,
            content: request.content,
            title: request.title,
            version: request.draftVersion,
            isDraft: true,
            isApproved: false,
          });
        }
        setLoading(false);
      });

    // Fetch reviews from API
    getReviews(requestId)
      .then((data: any) => {
        if (Array.isArray(data)) {
          setReviewComments(data.map((c: any) => ({
            id: c.id,
            userName: c.author ? `${c.author.firstName} ${c.author.lastName}` : 'Unknown',
            userInitials: c.author?.initials || '??',
            role: c.author?.role || 'Admin',
            time: new Date(c.createdAt).toLocaleString(),
            text: c.text,
            section: c.section || undefined,
            resolved: c.resolved,
          })));
        }
      })
      .catch(() => {
        // Fall back to context comments
        if (request?.comments) {
          setReviewComments(request.comments.map(c => ({
            ...c,
            resolved: c.resolved ?? false,
          })));
        }
      });
  }, [requestId]);

  // Use context comments as fallback/supplement
  const allComments = reviewComments.length > 0 ? reviewComments : (request?.comments || []);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(request.id, commentText, selectedSection);
    // Add to local state immediately for UI responsiveness
    setReviewComments(prev => [...prev, {
      id: 'comment_' + Date.now(),
      userName: 'You',
      userInitials: 'AD',
      role: 'Admin',
      time: 'Just now',
      text: commentText,
      section: selectedSection,
      resolved: false,
    }]);
    setCommentText('');
  };

  const handleApprove = () => {
    updateRequestStatus(request.id, 'COMPLETED');
    onBack();
  };

  const handleRequestRevision = () => {
    updateRequestStatus(request.id, 'REVISION_REQUESTED');
    onBack();
  };

  // Parse content into sections for the document preview
  const renderDocumentContent = () => {
    const content = report?.content || request?.content || '';
    if (!content) {
      return (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">No draft content available</p>
          <p className="text-xs mt-1">The research officer has not submitted a draft yet.</p>
        </div>
      );
    }

    // Split content into sections by numbered headers or double newlines
    const sections = content.split(/\n(?=\d+\.\s|Section\s|#{1,3}\s)/g).filter(Boolean);

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-sans font-bold text-center text-gray-900 leading-tight">
          {report?.title || request.title}
        </h1>
        <p className="text-xs text-center font-sans text-gray-500 font-bold uppercase tracking-wider">
          PRRMS Legislative Briefing Draft v{report?.version || request.draftVersion}.00
        </p>

        {sections.map((section, idx) => {
          const sectionId = `Section: ${idx + 1}. ${section.split('\n')[0].replace(/^\d+\.\s*/, '').replace(/^#+\s*/, '').trim()}`;
          const isSelected = selectedSection === sectionId;
          const lines = section.split('\n');
          const heading = lines[0].replace(/^\d+\.\s*/, '').replace(/^#+\s*/, '').trim();
          const body = lines.slice(1).join('\n').trim();

          return (
            <div 
              key={idx}
              onClick={() => setSelectedSection(sectionId)}
              className={`p-4 rounded border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-100'
                  : 'border-transparent hover:bg-gray-50/50'
              }`}
            >
              <h2 className="font-sans font-bold text-sm text-gray-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                {heading}
                {isSelected && <Sparkles className="w-3 h-3 text-[#0037b0]" />}
              </h2>
              {body ? (
                <div className="text-gray-700 font-serif text-sm leading-relaxed whitespace-pre-wrap">
                  {body}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No content in this section</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#0037b0] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* View Header with back controls */}
      <div className="flex justify-between items-center pb-4 border-b border-[#c4c5d7]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-full border border-gray-200 text-gray-700 transition-all"
            title="Back to List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#dce1ff] text-[#001551] font-bold text-xs px-2 py-0.5 rounded uppercase tracking-wider">
                {request.id}
              </span>
              <span className="text-xs text-gray-500 font-semibold">{request.category}</span>
              {report && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">
                  v{report.version} {report.isDraft ? '(Draft)' : '(Final)'}
                </span>
              )}
            </div>
            <h2 className="font-sans font-bold text-lg text-[#191c1d] mt-1">{request.title}</h2>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleRequestRevision}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-xs rounded transition-all"
          >
            Request Revision
          </button>
          <button 
            onClick={handleApprove}
            className="px-4 py-2 bg-[#006b2c] hover:bg-[#00501f] text-white font-semibold text-xs rounded transition-all shadow-sm"
          >
            Approve & Deliver
          </button>
        </div>
      </div>

      {/* Main Grid: Document Previewer left, comments panel right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Column: Document Canvas */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg shadow-sm flex flex-col justify-between overflow-hidden min-h-[600px]">
          
          {/* Preview toolbar */}
          <div className="bg-[#f3f4f5] border-b border-[#c4c5d7] px-6 py-3 flex justify-between items-center text-xs text-gray-600 font-semibold">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-red-600" />
              <span>{report?.title || 'Draft'}.pdf</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Version {report?.version || request.draftVersion}</span>
            </div>
          </div>

          {/* Document Content Workspace */}
          <div className="p-8 font-serif max-h-[500px] overflow-y-auto leading-relaxed text-sm text-[#191c1d]">
            {renderDocumentContent()}
          </div>

          {/* Info status strip at bottom of document preview */}
          <div className="bg-[#f3f4f5] border-t border-[#c4c5d7] px-6 py-2.5 text-[11px] text-[#434655] font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Assigned Officer: {request.assignedOfficerName || 'Unassigned'}</span>
            <span className="text-gray-300">|</span>
            <span>Deadline: {request.deadline}</span>
          </div>

        </div>

        {/* Right Column: Review Comments Feedback Board */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col justify-between min-h-[600px]">
          
          {/* Thread list */}
          <div className="space-y-5 flex-1 max-h-[380px] overflow-y-auto pr-1">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider">Review Feedback</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Click section blocks in draft to annotate specific elements.</p>
            </div>

            {allComments.length > 0 ? (
              <div className="space-y-4">
                {allComments.map((comment) => (
                  <div key={comment.id} className={`p-3 rounded-lg border space-y-1 ${
                    comment.resolved 
                      ? 'bg-emerald-50/30 border-emerald-200 opacity-60' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#dce1ff] text-[#001551] flex items-center justify-center font-bold text-[10px]">
                          {comment.userInitials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 leading-none">{comment.userName}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5">{comment.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {comment.resolved && (
                          <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Resolved</span>
                        )}
                        <span className="text-[9px] text-gray-400 font-semibold">{comment.time}</span>
                      </div>
                    </div>

                    {comment.section && (
                      <p className="text-[10px] text-[#0039b5] bg-blue-50 rounded px-1.5 py-0.5 font-bold truncate">
                        {comment.section}
                      </p>
                    )}

                    <p className="text-xs text-gray-700 leading-relaxed pt-1">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-gray-500 py-10 italic">
                No active comments on this draft yet. Use form below to submit a review comment.
              </div>
            )}
          </div>

          {/* Post Comment Input */}
          <form onSubmit={handlePostComment} className="border-t border-gray-100 pt-4 space-y-3">
            <div className="bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2 text-[10px] text-gray-600 font-bold flex justify-between items-center">
              <span className="truncate max-w-[200px]">Annotating: {selectedSection}</span>
              <button 
                type="button" 
                onClick={() => setSelectedSection('Section: 1. Executive Summary')}
                className="text-[#0037b0] hover:underline"
              >
                Clear
              </button>
            </div>
            
            <textarea 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add feedback annotation or requested edits..."
              className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs h-24 outline-none focus:ring-1 focus:ring-[#0037b0]"
              required
            />
            
            <button 
              type="submit"
              className="w-full bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-semibold text-xs py-2.5 rounded flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Post Annotation</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
