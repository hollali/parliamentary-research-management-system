import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getRequest, getReviews, createReport } from '../lib/api';
import { 
  FileText, 
  Save, 
  Send, 
  Check, 
  CornerDownRight, 
  MessageSquare,
  AlertCircle,
  Undo2,
  ArrowLeft,
  Loader2
} from 'lucide-react';

interface OfficerRevisionWorkspaceViewProps {
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

export const OfficerRevisionWorkspaceView: React.FC<OfficerRevisionWorkspaceViewProps> = ({ requestId, onBack }) => {
  const { requests, updateRequestContent, resolveComment, addComment, updateRequestStatus } = useApp();
  const request = requests.find(r => r.id === requestId) || requests[0];
  
  const [editorText, setEditorText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);

  // Fetch report content and reviews from API on mount
  useEffect(() => {
    if (!requestId) return;

    setLoading(true);

    // Fetch full request with reports
    getRequest(requestId)
      .then((data: any) => {
        if (data?.reports?.[0]) {
          setEditorText(data.reports[0].content || '');
          setReportId(data.reports[0].id);
          setDraftVersion(data.reports[0].version || 1);
        } else if (request?.content) {
          setEditorText(request.content);
          setReportId(request.reportId || null);
          setDraftVersion(request.draftVersion);
        } else {
          setEditorText(`Report draft for ${request?.title || 'Unknown'}.\n\nSection 1: Executive Summary\n[Edit this draft to add your summary analysis here]`);
        }
        setLoading(false);
      })
      .catch(() => {
        // Fall back to context data
        setEditorText(request?.content || '');
        setReportId(request?.reportId || null);
        setDraftVersion(request?.draftVersion || 1);
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

  const unresolvedComments = reviewComments.filter(c => !c.resolved);

  const handleSaveDraft = async () => {
    updateRequestContent(request.id, editorText);
    
    // Also save to backend if online and we have a report
    if (reportId) {
      try {
        await createReport({
          requestId: request.id,
          title: request.title,
          content: editorText,
          isDraft: true,
          notes: `Draft saved (v${draftVersion})`,
        });
      } catch {
        // Local save already happened
      }
    }
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    updateRequestContent(request.id, editorText);
    
    // Create new report version via API
    try {
      await createReport({
        requestId: request.id,
        title: request.title,
        content: editorText,
        isDraft: true,
        notes: `Revision v${draftVersion + 1} submitted for review`,
      });
    } catch {
      // Fall through to local-only
    }
    
    updateRequestStatus(request.id, 'PENDING_REVIEW');
    setSubmitting(false);
    onBack();
  };

  const handleResolveComment = async (commentId: string) => {
    await resolveComment(request.id, commentId);
    // Update local state
    setReviewComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, resolved: true } : c
    ));
  };

  const handlePostReply = (commentId: string) => {
    if (!replyText.trim()) return;
    addComment(request.id, replyText, `Reply to comment thread`);
    // Add to local state
    setReviewComments(prev => [...prev, {
      id: 'comment_' + Date.now(),
      userName: 'You',
      userInitials: request?.assignedOfficerName?.split(' ').pop()?.slice(0, 2).toUpperCase() || 'RO',
      role: 'Researcher',
      time: 'Just now',
      text: replyText,
      section: 'Reply to comment thread',
      resolved: false,
    }]);
    setReplyText('');
    setActiveCommentId(null);
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
      {/* Workspace Header */}
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
              <span className="bg-orange-100 text-orange-800 font-bold text-xs px-2.5 py-0.5 rounded uppercase tracking-wider">
                Revision Workspace
              </span>
              <span className="text-xs text-gray-500 font-semibold">{request.category}</span>
            </div>
            <h2 className="font-sans font-bold text-lg text-[#191c1d] mt-1">{request.title}</h2>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleSaveDraft}
            className="px-4 py-2 border border-[#c4c5d7] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button 
            onClick={handleSubmitReview}
            disabled={submitting}
            className="px-4 py-2 bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-semibold text-xs rounded transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{submitting ? 'Submitting...' : 'Submit for Review'}</span>
          </button>
        </div>
      </div>

      {/* Editor layout columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left editor text card */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg shadow-sm flex flex-col justify-between overflow-hidden min-h-[550px]">
          <div className="bg-[#f3f4f5] border-b border-[#c4c5d7] px-6 py-3 flex justify-between items-center text-xs text-gray-600 font-semibold">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-600" />
              <span>Editing active briefing draft content</span>
            </span>
            <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200 font-bold uppercase text-gray-500">
              Draft v{draftVersion}
            </span>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <textarea 
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              className="w-full flex-1 p-4 border border-[#c4c5d7] rounded-lg font-serif text-sm leading-relaxed outline-none focus:ring-1 focus:ring-[#0037b0] resize-none min-h-[400px]"
              placeholder="Start drafting the briefing document here..."
            />
          </div>

          <div className="bg-[#f3f4f5] border-t border-[#c4c5d7] px-6 py-3 text-xs text-gray-500 font-semibold flex justify-between items-center">
            <span>Word count: {editorText.split(/\s+/).filter(Boolean).length} words</span>
            <span>Last auto-saved: Just now</span>
          </div>
        </div>

        {/* Right Comments Sidebar Panel */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col gap-5 overflow-y-auto">
          <div>
            <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <MessageSquare className="w-4 h-4 text-[#0037b0]" /> Active Annotations
            </h4>
            <p className="text-[11px] text-gray-500 mt-1 leading-normal">
              Address and resolve the administrative feedback comments to complete the revision.
            </p>
          </div>

          <div className="space-y-4 flex-1">
            {unresolvedComments.length > 0 ? (
              unresolvedComments.map((comment) => (
                <div key={comment.id} className="p-4 bg-amber-50/50 border border-amber-200 rounded-lg space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-gray-900">{comment.userName}</p>
                      <span className="text-[10px] text-gray-400 font-semibold">{comment.time}</span>
                    </div>
                    {comment.section && (
                      <p className="text-[9px] text-[#0039b5] bg-blue-50/50 px-1.5 py-0.5 rounded font-bold inline-block">
                        {comment.section}
                      </p>
                    )}
                    <p className="text-xs text-gray-700 leading-relaxed italic">"{comment.text}"</p>
                  </div>

                  {/* Comment interaction controls */}
                  <div className="flex items-center gap-2 border-t border-amber-200/50 pt-2.5">
                    <button 
                      onClick={() => handleResolveComment(comment.id)}
                      className="text-xs font-bold text-[#006b2c] hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                    <span className="text-gray-300">|</span>
                    <button 
                      onClick={() => setActiveCommentId(comment.id)}
                      className="text-xs font-bold text-[#434655] hover:underline"
                    >
                      Reply
                    </button>
                  </div>

                  {/* Reply Input block */}
                  {activeCommentId === comment.id && (
                    <div className="space-y-2 border-t border-amber-200/50 pt-2.5">
                      <input 
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply response..."
                        className="w-full bg-white border border-[#c4c5d7] rounded p-1.5 text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setActiveCommentId(null)}
                          className="text-[10px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          onClick={() => handlePostReply(comment.id)}
                          className="text-[10px] font-bold text-white bg-[#0037b0] px-2.5 py-1 rounded"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 space-y-2 bg-emerald-50/50 rounded-lg border border-emerald-100 p-5">
                <Check className="w-8 h-8 text-[#006b2c] mx-auto" />
                <h5 className="text-xs font-bold text-emerald-800">All Comments Addressed!</h5>
                <p className="text-[10px] text-gray-500 leading-normal">
                  You have successfully resolved all administrative reviews. You can now submit this revision.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
