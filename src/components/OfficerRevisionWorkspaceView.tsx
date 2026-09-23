import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { getRequest, getReviews, createReport, updateReport, getAttachments, uploadFile, downloadFile, deleteAttachment } from '../lib/api';
import { highlightText } from '../lib/highlight';
import { normalizeFetchedRequest } from '../lib/requestNormalize';
import { ResearchRequest } from '../types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
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
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Minus,
  Undo,
  Redo
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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedText = useRef('');
  const reportIdRef = useRef<string | null>(null);
  const draftVersionRef = useRef(1);
  const requestRef = useRef<ResearchRequest | null>(request);

  const autoSave = useCallback(async (html: string, plain: string) => {
    if (html === lastSavedText.current || plain.trim().length < 10) return;
    lastSavedText.current = html;
    updateRequestContent(requestId, html);
    try {
      if (reportIdRef.current) {
        await updateReport(reportIdRef.current, { content: html, notes: 'Auto-saved' });
      } else {
        const data = await createReport({
          requestId,
          title: requestRef.current?.title || 'Research Brief',
          content: html,
          isDraft: true,
          notes: 'Auto-saved',
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
    } catch {
      // silent — manual save still available
    }
  }, [requestId, updateRequestContent]);

  const editor = useEditor({
    extensions: [StarterKit, Highlight.configure({ multicolor: true })],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none font-serif text-sm leading-relaxed min-h-[400px] h-full outline-none p-4',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const plain = editor.getText();
      setEditorText(plain);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => autoSave(html, plain), 3000);
    },
  });

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
        if (editor && content) {
          editor.commands.setContent(content, { emitUpdate: false });
        }
        finishLoading();
      })
      .catch(() => {
        const fallback = request?.content || '';
        setEditorText(fallback);
        reportIdRef.current = request?.reportId || null;
        setReportId(request?.reportId || null);
        draftVersionRef.current = request?.draftVersion || 1;
        setDraftVersion(request?.draftVersion || 1);
        if (editor && fallback) {
          editor.commands.setContent(fallback, { emitUpdate: false });
        }
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
      })
      .catch(() => console.warn('Failed to load attachments'));

    return () => {
      clearTimeout(watchdog);
      ignore = true;
    };
  }, [requestId]);

  const unresolvedComments = reviewComments.filter(c => !c.resolved);

  // Rebuild highlights only when the set of annotated comments changes,
  // never while the officer is typing (avoids resetting the caret each keystroke).
  const highlightSignature = useMemo(
    () => JSON.stringify(reviewComments.map(c => c.highlightedText || '')),
    [reviewComments],
  );

  useEffect(() => {
    if (!editor) return;
    // Only rewrite the document when there are actual annotations; with none,
    // the document may contain rich formatting we must not flatten.
    const hasHighlights = reviewComments.some(
      (c) => c.highlightedText && c.highlightedText.length > 2,
    );
    if (!hasHighlights) return;
    const content = highlightText(editor.getText(), reviewComments);
    if (!content.trim() || editor.getHTML() === content) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(content, { emitUpdate: false });
    const size = editor.state.doc.content.size;
    try {
      editor.commands.setTextSelection({
        from: Math.min(from, size),
        to: Math.min(to, size),
      });
    } catch {
      // Selection may be outside the new doc; ignore.
    }
  }, [highlightSignature]);

  const handleSaveDraft = async () => {
    const plain = editor?.getText() ?? editorText;
    const html = editor?.getHTML() ?? editorText;
    if (!plain.trim()) {
      toast.error('Nothing to save — the draft is empty.');
      return;
    }
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
    const html = editor?.getHTML() ?? editorText;
    const plain = editor?.getText() ?? editorText;
    if (!plain.trim()) {
      setSubmitting(false);
      toast.error('Cannot submit an empty brief.');
      return;
    }
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
    if (!att?.id) return;
    try {
      await deleteAttachment(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success(`"${att.name}" removed.`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to remove "${att.name}"`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[#0037b0] animate-spin" />
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

          {/* Toolbar */}
          {editor && (
            <div className="border-b border-[#c4c5d7] px-4 py-2 flex items-center gap-1 flex-wrap">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('bold') ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('italic') ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('strike') ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Heading 1"
              >
                <Heading1 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Heading 2"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('bulletList') ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('orderedList') ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${editor.isActive('blockquote') ? 'bg-[#dce1ff] text-[#0037b0]' : 'text-gray-500'}`}
                title="Blockquote"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                title="Horizontal Rule"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
                title="Undo"
              >
                <Undo className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
                title="Redo"
              >
                <Redo className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-[400px] max-h-[600px]">
            <EditorContent editor={editor} className="p-6" />
          </div>

          <div className="bg-[#f3f4f5] border-t border-[#c4c5d7] px-6 py-3 text-xs text-gray-500 font-semibold flex justify-between items-center">
            <span>Word count: {editor ? editor.getText().split(/\s+/).filter(Boolean).length : 0} words</span>
            <span>{lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Not yet saved'}</span>
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
        {attachments.length > 0 ? (
          <div className="space-y-2">
            {attachments.map((att: any, idx: number) => (
              <div key={att.id || idx} className="bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg p-2.5 flex justify-between items-center text-xs shadow-sm">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-red-500" />
                  <span className="font-semibold text-gray-900">{att.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 font-bold">{att.fileSize ? `${(att.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}</span>
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
    </div>
  );
};
