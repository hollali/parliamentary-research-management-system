import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getRequest, getReviews } from '../lib/api';
import { ResearchRequest } from '../types';
import { 
  FileText, 
  Send, 
  Sparkles,
  ArrowLeft,
  Loader2,
  Highlighter,
  X
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
  highlightedText?: string;
  resolved: boolean;
  replies?: ReviewComment[];
  parentId?: string;
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
  const [highlightedText, setHighlightedText] = useState('');
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const documentRef = useRef<HTMLDivElement>(null);

  const request = requests.find(r => r.id === requestId) || requests[0];

  useEffect(() => {
    if (!requestId) return;
    setLoading(true);

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
            highlightedText: c.highlightedText || undefined,
            resolved: c.resolved,
            parentId: c.parentId || undefined,
            replies: (c.replies || []).map((r: any) => ({
              id: r.id,
              userName: r.author ? `${r.author.firstName} ${r.author.lastName}` : 'Unknown',
              userInitials: r.author?.initials || '??',
              role: r.author?.role || 'Admin',
              time: new Date(r.createdAt).toLocaleString(),
              text: r.text,
              section: r.section || undefined,
              highlightedText: r.highlightedText || undefined,
              resolved: r.resolved,
              parentId: r.parentId || undefined,
            })),
          })));
        }
      })
      .catch(() => {
        if (request?.comments) {
          setReviewComments(request.comments.map(c => ({
            ...c,
            resolved: c.resolved ?? false,
          })));
        }
      });
  }, [requestId]);

  const allComments = reviewComments.length > 0 ? reviewComments : (request?.comments || []);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }
    const text = selection.toString().trim();
    if (text.length < 3) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = documentRef.current?.getBoundingClientRect();

    if (containerRect) {
      setPopoverPosition({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 10,
      });
    }
    setHighlightedText(text);
    setShowAnnotationPopover(true);
  }, []);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(request.id, commentText, selectedSection, highlightedText || undefined);
    setReviewComments(prev => [...prev, {
      id: 'comment_' + Date.now(),
      userName: 'You',
      userInitials: 'AD',
      role: 'Admin',
      time: 'Just now',
      text: commentText,
      section: selectedSection,
      highlightedText: highlightedText || undefined,
      resolved: false,
    }]);
    setCommentText('');
    setHighlightedText('');
    setShowAnnotationPopover(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleApprove = () => {
    updateRequestStatus(request.id, 'APPROVED');
    onBack();
  };

  const handleRequestRevision = () => {
    updateRequestStatus(request.id, 'REVISION_REQUESTED');
    onBack();
  };

  // Helper to wrap annotated text in <mark> tags
  const highlightText = (text: string, comments: { highlightedText?: string }[]): string => {
    const highlights = comments
      .filter(c => c.highlightedText && c.highlightedText.length > 2)
      .map(c => c.highlightedText!);
    if (highlights.length === 0) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (const h of highlights) {
      const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const regex = new RegExp(`(${escaped})`, 'gi');
      html = html.replace(regex, '<mark class="bg-yellow-200 text-yellow-900 px-0.5 rounded cursor-pointer" title="Annotated by admin">$1</mark>');
    }
    return html;
  };

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
                  ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100'
                  : 'border-transparent hover:bg-gray-50/50'
              }`}
            >
              <h2 className="font-sans font-bold text-sm text-gray-900 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                {heading}
                {isSelected && <Sparkles className="w-3 h-3 text-[#0037b0]" />}
              </h2>
              {body ? (
                <div 
                  className="text-gray-700 font-serif text-sm leading-relaxed whitespace-pre-wrap select-text"
                  dangerouslySetInnerHTML={{ __html: highlightText(body, allComments) }}
                />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Column: Document Canvas */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg shadow-sm flex flex-col justify-between overflow-hidden min-h-[600px] relative">
          
          <div className="bg-[#f3f4f5] border-b border-[#c4c5d7] px-6 py-3 flex justify-between items-center text-xs text-gray-600 font-semibold">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-red-600" />
              <span>{report?.title || 'Draft'}.pdf</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-[#0037b0]">
                <Highlighter className="w-3.5 h-3.5" />
                Select text to annotate
              </span>
              <span>Version {report?.version || request.draftVersion}</span>
            </div>
          </div>

          <div 
            ref={documentRef}
            onMouseUp={handleTextSelection}
            className="p-8 font-serif max-h-[500px] overflow-y-auto leading-relaxed text-sm text-[#191c1d]"
          >
            {renderDocumentContent()}
          </div>

          {/* Floating Annotation Popover */}
          {showAnnotationPopover && (
            <div 
              className="absolute z-50"
              style={{ left: popoverPosition.x, top: popoverPosition.y, transform: 'translate(-50%, -100%)' }}
            >
              <div className="bg-[#191c1d] text-white rounded-lg shadow-xl p-3 flex items-center gap-2 text-xs">
                <Highlighter className="w-3.5 h-3.5 text-yellow-400" />
                <span className="font-semibold max-w-[200px] truncate">"{highlightedText.slice(0, 40)}{highlightedText.length > 40 ? '...' : ''}"</span>
                <button
                  onClick={() => {
                    setShowAnnotationPopover(false);
                    setHighlightedText('');
                    window.getSelection()?.removeAllRanges();
                  }}
                  className="text-gray-400 hover:text-white ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex justify-center mt-1">
                <div className="w-2 h-2 bg-[#191c1d] rotate-45" />
              </div>
            </div>
          )}

          <div className="bg-[#f3f4f5] border-t border-[#c4c5d7] px-6 py-2.5 text-[11px] text-[#434655] font-semibold flex items-center gap-1.5">
            <span>Assigned Officer: {request.assignedOfficerName || 'Unassigned'}</span>
            <span className="text-gray-300">|</span>
            <span>Deadline: {request.deadline}</span>
          </div>

        </div>

        {/* Right Column: Review Comments Feedback Board */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col justify-between min-h-[600px]">
          
          <div className="space-y-5 flex-1 max-h-[380px] overflow-y-auto pr-1">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider">Review Feedback</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Select text in the draft to annotate specific areas, or click a section to target it.</p>
            </div>

            {allComments.length > 0 ? (
              <div className="space-y-4">
                {allComments.map((comment) => (
                  <div key={comment.id} className={`p-3 rounded-lg border space-y-1.5 ${
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

                    {comment.highlightedText && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                        <p className="text-[10px] text-yellow-700 font-semibold flex items-center gap-1">
                          <Highlighter className="w-3 h-3" />
                          Highlighted text:
                        </p>
                        <p className="text-[10px] text-gray-600 italic mt-0.5">"{comment.highlightedText}"</p>
                      </div>
                    )}

                    <p className="text-xs text-gray-700 leading-relaxed pt-0.5">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-gray-500 py-10 italic">
                No active comments on this draft yet. Select text or use the form below.
              </div>
            )}
          </div>

          {/* Post Comment Input */}
          <form onSubmit={handlePostComment} className="border-t border-gray-100 pt-4 space-y-3">
            <div className="bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2 text-[10px] text-gray-600 font-bold flex justify-between items-center">
              <span className="truncate max-w-[200px]">
                {highlightedText 
                  ? `Annotating: "${highlightedText.slice(0, 30)}${highlightedText.length > 30 ? '...' : ''}"`
                  : `Annotating: ${selectedSection}`
                }
              </span>
              <button 
                type="button" 
                onClick={() => {
                  setSelectedSection('Section: 1. Executive Summary');
                  setHighlightedText('');
                  setShowAnnotationPopover(false);
                }}
                className="text-[#0037b0] hover:underline"
              >
                Clear
              </button>
            </div>
            
            <textarea 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={highlightedText ? "Add feedback about this highlighted text..." : "Add feedback annotation or requested edits..."}
              className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs h-24 outline-none focus:ring-1 focus:ring-[#0037b0]"
              required
            />
            
            <button 
              type="submit"
              className="w-full bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-semibold text-xs py-2.5 rounded flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{highlightedText ? 'Post Annotation on Selection' : 'Post Annotation'}</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
