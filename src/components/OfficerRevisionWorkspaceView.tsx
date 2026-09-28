import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { getRequest, getReviews, createReport, updateReport, getAttachments, uploadFile, downloadFile, deleteAttachment } from '../lib/api';
import { normalizeFetchedRequest } from '../lib/requestNormalize';
import { honourable } from '../lib/format';
import { ResearchRequest } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { RichTextEditor } from './editor/RichTextEditor';
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
  Loader2,
  Upload,
  Download,
  Trash2,
  Paperclip,
  ChevronDown
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
  highlightedText?: string;
  resolved: boolean;
  replies?: ReviewComment[];
  parentId?: string;
}

export const OfficerRevisionWorkspaceView: React.FC<OfficerRevisionWorkspaceViewProps> = ({ requestId, onBack }) => {
  const { requests, updateRequestContent, resolveComment, addComment, updateRequestStatus, templates } = useApp();
  const { toast } = useToast();
  const contextRequest = requests.find(r => r.id === requestId) || requests[0] || null;
  const [fetchedRequest, setFetchedRequest] = useState<ResearchRequest | null>(null);
  const request = contextRequest || fetchedRequest;
  
  const [editorText, setEditorText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsError, setAttachmentsError] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedText = useRef('');
  const reportIdRef = useRef<string | null>(null);
  const draftVersionRef = useRef(1);
  const requestRef = useRef<ResearchRequest | null>(request);

  const [initialContent, setInitialContent] = useState('');
  const htmlRef = useRef('');
  const pendingRef = useRef<{ html: string; plain: string } | null>(null);
  const unmountedRef = useRef(false);

  const autoSave = useCallback(async (html: string, plain: string, keepalive = false) => {
    if (html === lastSavedText.current || plain.trim().length < 10) return;
    lastSavedText.current = html;
    updateRequestContent(requestId, html);
    try {
      if (reportIdRef.current) {
        await updateReport(reportIdRef.current, { content: html, notes: 'Auto-saved' }, { keepalive });
      } else {
        const data = await createReport(
          {
            requestId,
            title: requestRef.current?.title || 'Research Brief',
            content: html,
            isDraft: true,
            notes: 'Auto-saved',
          },
          { keepalive },
        );
        if (unmountedRef.current) return;
        if (data?.id) {
          reportIdRef.current = data.id;
          setReportId(data.id);
        }
        if (data?.version) {
          draftVersionRef.current = data.version;
          setDraftVersion(data.version);
        }
      }
      if (!unmountedRef.current) setLastSaved(new Date());
    } catch {
      // silent — manual save still available
    }
  }, [requestId, updateRequestContent]);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  }, []);

  // Persists edits made inside the debounce window that would otherwise be lost
  // when the officer navigates away or closes the tab.
  const flushPending = useCallback(
    (keepalive: boolean) => {
      const pending = pendingRef.current;
      if (!pending) return;
      clearPending();
      void autoSave(pending.html, pending.plain, keepalive);
    },
    [autoSave, clearPending],
  );

  // autoSave is rebuilt whenever the context re-renders, so the teardown and
  // pagehide handlers read through a ref to stay registered exactly once.
  const flushRef = useRef(flushPending);
  flushRef.current = flushPending;

  const handleEditorChange = useCallback((html: string, plain: string) => {
    htmlRef.current = html;
    setEditorText(plain);
    pendingRef.current = { html, plain };
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveTimer.current = null;
      flushRef.current(false);
    }, 3000);
  }, []);

  // Seeds the saved-content cache from the loaded document without queueing an
  // autosave, so Save Draft and Submit work on a draft the officer has not typed in.
  const handleEditorLoaded = useCallback((html: string, plain: string) => {
    htmlRef.current = html;
    setEditorText(plain);
    lastSavedText.current = html;
    pendingRef.current = null;
  }, []);

  // Fetch report content and reviews from API on mount
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      flushRef.current(false);
    };
  }, []);

  useEffect(() => {
    const onPageHide = () => flushRef.current(true);
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  // Fetch report content and reviews from API on mount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    if (!requestId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Safety net: never leave the loading spinner stuck forever if a request stalls.
    const watchdog = setTimeout(() => {
      if (!ignore) setLoading(false);
    }, 10000);
    const finishLoading = () => {
      clearTimeout(watchdog);
      if (!ignore) setLoading(false);
    };

    // Fetch full request with reports
    getRequest(requestId)
      .then((data: any) => {
        if (ignore) return;
        const normalized = normalizeFetchedRequest(data, requestId);
        setFetchedRequest(normalized);
        requestRef.current = normalized;
        let content = '';
        if (data?.reports?.[0]) {
          content = data.reports[0].content || '';
          reportIdRef.current = data.reports[0].id;
          setReportId(data.reports[0].id);
          draftVersionRef.current = data.reports[0].version || 1;
          setDraftVersion(data.reports[0].version || 1);
        } else if (request?.content) {
          content = request.content;
          reportIdRef.current = request.reportId || null;
          setReportId(request.reportId || null);
          draftVersionRef.current = request.draftVersion;
          setDraftVersion(request.draftVersion);
        } else {
          // Try to pre-fill from the assigned template
          const templateId = request?.templateId || data?.templateId;
          const tpl = templates.find((t) => t.id === templateId);
          if (tpl && Array.isArray(tpl.sections) && tpl.sections.length > 0) {
            const sections = tpl.sections as { heading: string; prompt: string }[];
            content = `# ${request?.title || 'Research Brief'}\n\n`;
            content += `> Template: ${tpl.name}\n\n`;
            for (const s of sections) {
              content += `## ${s.heading}\n\n_${s.prompt}_\n\n[Write your content here]\n\n`;
            }
          } else {
            content = `Report draft for ${request?.title || 'Unknown'}.\n\nSection 1: Executive Summary\n[Edit this draft to add your summary analysis here]`;
          }
        }
        setEditorText(content);
        setInitialContent(content);
        finishLoading();
      })
      .catch(() => {
        const fallback = request?.content || '';
        setEditorText(fallback);
        reportIdRef.current = request?.reportId || null;
        setReportId(request?.reportId || null);
        draftVersionRef.current = request?.draftVersion || 1;
        setDraftVersion(request?.draftVersion || 1);
        setInitialContent(fallback);
        finishLoading();
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
        // Fall back to context comments
        if (request?.comments) {
          setReviewComments(request.comments.map(c => ({
            ...c,
            resolved: c.resolved ?? false,
          })));
        }
      });

    // Fetch attachments
    getAttachments(requestId)
      .then((data: any) => {
        if (Array.isArray(data)) {
          setAttachments(data);
        }
        setAttachmentsError(false);
      })
      .catch(() => setAttachmentsError(true));

    return () => {
      clearTimeout(watchdog);
      ignore = true;
    };
  }, [requestId]);

  const unresolvedComments = reviewComments.filter(c => !c.resolved);
  const resolvedCount = reviewComments.length - unresolvedComments.length;
  const [showResolved, setShowResolved] = useState(false);

  const shortId = (id: string) => (id.length > 8 ? `O#${id.slice(0, 8)}` : id);

  const fileIconColor = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'text-red-500';
    if (['docx', 'doc', 'rtf', 'odt', 'txt'].includes(ext)) return 'text-blue-500';
    if (['xlsx', 'xls', 'csv'].includes(ext)) return 'text-emerald-600';
    if (['pptx', 'ppt'].includes(ext)) return 'text-orange-500';
    return 'text-indigo-500';
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
  };

  // Reviewer annotations are rendered as ProseMirror decorations over the live
  // document, so highlighting never rewrites or flattens the officer's formatting.
  const annotationTargets = useMemo(
    () =>
      reviewComments
        .filter((c) => !c.resolved && c.highlightedText && c.highlightedText.length > 2)
        .map((c) => ({ text: c.highlightedText!, commentId: c.id, author: c.userName })),
    [reviewComments],
  );

  const handleSaveDraft = async () => {
    const plain = editorText;
    const html = htmlRef.current || editorText;
    if (!plain.trim()) {
      toast.error('Nothing to save — the draft is empty.');
      return;
    }
    // A manual save supersedes anything queued in the debounce window.
    clearPending();
    updateRequestContent(requestId, html);
    lastSavedText.current = html;

    try {
      if (reportIdRef.current) {
        await updateReport(reportIdRef.current, { content: html, notes: `Draft saved (v${draftVersionRef.current})` });
      } else {
        const data = await createReport({
          requestId,
          title: requestRef.current?.title || 'Research Brief',
          content: html,
          isDraft: true,
          notes: `Draft saved (v${draftVersionRef.current})`,
        });
        if (data?.id) {
          reportIdRef.current = data.id;
          setReportId(data.id);
        }
        if (data?.version) {
          draftVersionRef.current = data.version;
          setDraftVersion(data.version);
        }
      }
      setLastSaved(new Date());
      toast.success('Draft saved');
    } catch {
      toast.error('Failed to save draft');
    }
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    const html = htmlRef.current || editorText;
    const plain = editorText;
    if (!plain.trim()) {
      setSubmitting(false);
      toast.error('Cannot submit an empty brief.');
      return;
    }
    // Submitting creates a new version, so drop the queued autosave to avoid
    // writing the same content twice.
    clearPending();
    updateRequestContent(requestId, html);
    
    // Get latest attachment info if available
    let latestAttachment: any = null;
    try {
      const data = await getAttachments(requestId);
      if (Array.isArray(data) && data.length > 0) {
        latestAttachment = data[0];
      }
    } catch {}

    // Create new report version via API
    try {
      await createReport({
          requestId,
          title: requestRef.current?.title || 'Research Brief',
          content: html,
          isDraft: false,
          filePath: latestAttachment?.filePath || undefined,
          fileType: latestAttachment?.fileType || undefined,
          fileSize: latestAttachment?.fileSize || undefined,
          notes: `Revision v${draftVersion + 1} submitted for review`,
        });
    } catch {
      // Fall through to local-only
    }
    
    // First submission lands on DRAFT_SUBMITTED (waiting for review); a
    // resubmission after a revision request lands on REVISED so the reviewer
    // queue can pick it back up.
    const targetStatus: ResearchRequest["status"] =
      request?.status === "REVISION_REQUESTED" ? "REVISED" : "DRAFT_SUBMITTED";

    updateRequestStatus(requestId, targetStatus);
    setSubmitting(false);
    onBack();
  };

  const handleResolveComment = async (commentId: string) => {
    await resolveComment(requestId, commentId);
    // Update local state
    setReviewComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, resolved: true } : c
    ));
  };

  const handlePostReply = (parentId: string) => {
    if (!replyText.trim()) return;
    addComment(requestId, replyText, undefined, undefined, undefined, undefined, parentId);
    // Add reply nested under parent comment
    const newReply: ReviewComment = {
      id: 'comment_' + Date.now(),
      userName: 'You',
      userInitials: request?.assignedOfficerName?.split(' ').pop()?.slice(0, 2).toUpperCase() || 'RO',
      role: 'Researcher',
      time: 'Just now',
      text: replyText,
      resolved: false,
      parentId,
    };
    setReviewComments(prev => prev.map(c => 
      c.id === parentId
        ? { ...c, replies: [...(c.replies || []), newReply] }
        : c
    ));
    setReplyText('');
    setActiveCommentId(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    for (let i = 0; i < files.length; i++) {
      try {
        const result = await uploadFile(requestId, files[i]);
        setAttachments(prev => [result, ...prev]);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      } catch {
        // continue with next file
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleRemoveAttachment = async (att: any) => {
    if (att?.id) setConfirmRemove(att);
  };

  const confirmRemoveAttachment = async () => {
    if (!confirmRemove?.id) return;
    try {
      await deleteAttachment(confirmRemove.id);
      setAttachments(prev => prev.filter(a => a.id !== confirmRemove.id));
      toast.success(`"${confirmRemove.name}" removed.`);
      setConfirmRemove(null);
    } catch (err: any) {
      toast.error(err?.message || `Failed to remove "${confirmRemove.name}"`);
    }
  };

  const retryAttachments = useCallback(() => {
    setAttachmentsError(false);
    getAttachments(requestId)
      .then((data: any) => {
        if (Array.isArray(data)) {
          setAttachments(data);
        }
      })
      .catch(() => setAttachmentsError(true));
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#0037b0] animate-spin" />
        <p className="text-xs font-semibold text-[#747686] mt-3">Loading revision workspace...</p>
      </div>
    );
  }

  if (!requestId) {
    return (
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center space-y-4">
        <FileText className="w-12 h-12 text-gray-300 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900">No Request Selected</h3>
        <p className="text-sm text-[#434655] max-w-md mx-auto">
          Select a request from your workflow to start drafting.
        </p>
        <button
          onClick={onBack}
          className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded"
        >
          Back to Workflow
        </button>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-10 text-center space-y-4">
        <FileText className="w-12 h-12 text-gray-300 mx-auto" />
        <h3 className="text-lg font-bold text-gray-900">Request Not Found</h3>
        <p className="text-sm text-[#434655] max-w-md mx-auto">
          Unable to load this request. It may have been removed or is no longer
          accessible.
        </p>
        <button
          onClick={onBack}
          className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded"
        >
          Back to Assignments
        </button>
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
              <span className="text-xs font-bold text-gray-400">{shortId(request.id)}</span>
              <span className="text-xs text-gray-500 font-semibold capitalize">{request.category}</span>
            </div>
            <h2 className="font-sans font-bold text-xl text-[#191c1d] mt-1.5 leading-snug">{request.title}</h2>
            <p className="text-xs text-gray-500 mt-1">
              Requested by{" "}
              <span className="font-bold text-gray-700">{honourable(request.member)}</span>
              {" · "}Due{" "}
              <span className="font-bold text-gray-700">{request.deadline}</span>
            </p>
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

          <div className="flex-1 min-h-0 max-h-[600px]">
            <RichTextEditor
              content={initialContent}
              onChange={handleEditorChange}
              onContentLoaded={handleEditorLoaded}
              annotations={annotationTargets}
              onAnnotationClick={setActiveCommentId}
            />
          </div>

          <div className="bg-[#f3f4f5] border-t border-[#c4c5d7] px-6 py-3 text-xs text-gray-500 font-semibold flex justify-between items-center">
            <span>{lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Not yet saved'}</span>
          </div>
        </div>

        {/* Right Comments Sidebar Panel */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col gap-5 overflow-y-auto">
          <div>
            <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <MessageSquare className="w-4 h-4 text-[#0037b0]" /> Active Annotations
              {unresolvedComments.length > 0 && (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5">
                  {unresolvedComments.length} open
                </span>
              )}
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
                    {comment.highlightedText && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mt-1">
                        <p className="text-[10px] text-yellow-700 font-semibold">Referenced text:</p>
                        <p className="text-[10px] text-gray-600 italic">"{comment.highlightedText}"</p>
                      </div>
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

                  {/* Nested Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-amber-200/50">
                      {comment.replies.map(reply => (
                        <div key={reply.id} className="flex gap-2 items-start pl-3 border-l-2 border-amber-300">
                          <div className="w-5 h-5 rounded-full bg-[#dce1ff] flex items-center justify-center text-[8px] font-bold text-[#001551] shrink-0 mt-0.5">
                            {reply.userInitials}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-bold text-gray-900">{reply.userName}</p>
                              <span className="text-[9px] text-gray-400">{reply.time}</span>
                            </div>
                            <p className="text-[11px] text-gray-700 leading-relaxed">{reply.text}</p>
                          </div>
                        </div>
                      ))}
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

          {/* Resolved comments (collapsible, read-only) */}
          {resolvedCount > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="w-full flex items-center justify-between text-xs font-bold text-[#434655] hover:text-[#191c1d] py-1 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#006b2c]" />
                  Resolved ({resolvedCount})
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showResolved ? 'rotate-180' : ''}`} />
              </button>
              {showResolved && (
                <div className="space-y-2.5 mt-2">
                  {reviewComments.filter((c) => c.resolved).map((comment) => (
                    <div key={comment.id} className="p-3 bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg space-y-1.5 opacity-90">
                      <div className="flex justify-between items-start">
                        <p className="text-[11px] font-bold text-gray-700">{comment.userName}</p>
                        <span className="text-[9px] text-gray-400 font-semibold">{comment.time}</span>
                      </div>
                      {comment.highlightedText && (
                        <p className="text-[10px] text-gray-500 italic">"{comment.highlightedText}"</p>
                      )}
                      <p className="text-[10px] text-gray-500 leading-relaxed">{comment.text}</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5">
                        <Check className="w-2.5 h-2.5" /> Resolved
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Attachments Section */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-[#0037b0]" /> Attached Files
          </h4>
          <label className="px-3 py-1.5 border border-[#c4c5d7] hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? `Uploading... ${uploadProgress}%` : 'Upload File'}</span>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.rtf,.odt,.zip"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-[#0037b0] h-1.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        {attachmentsError && (
          <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-[11px] font-semibold text-[#ba1a1a] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Could not load attachments.
            </p>
            <button
              onClick={retryAttachments}
              className="text-[10px] font-bold text-[#ba1a1a] hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((att: any, idx: number) => (
              <div key={att.id || idx} className="bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg p-2.5 flex justify-between items-center text-xs shadow-sm">
                <div className="flex items-center gap-2.5">
                  <FileText className={`w-4 h-4 ${fileIconColor(att.name)}`} />
                  <span className="font-semibold text-gray-900">{att.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-bold">{formatSize(att.fileSize)}</span>
                  {att.id && (
                    <>
                      <button
                        onClick={() => handleRemoveAttachment(att)}
                        className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => downloadFile(att.id, att.name).catch(() => toast.error(`Failed to download "${att.name}"`))}
                        className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-[#0037b0] transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 text-center py-4">No files attached yet.</p>
        )}
      </div>

      {confirmRemove && (
        <ConfirmDialog
          title="Remove Attachment"
          confirmLabel="Remove"
          message={
            <>
              Remove <strong>{confirmRemove.name}</strong>? This action cannot be undone.
            </>
          }
          onConfirm={confirmRemoveAttachment}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
};
