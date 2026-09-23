import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../lib/toast";
import { formatRequestStatus } from "../lib/status";
import {
  getRequest,
  downloadFile,
  uploadFile,
  deleteAttachment,
  validateUploadFile,
  getReviews,
} from "../lib/api";
import { honourable } from "../lib/format";
import { toPlainText } from "../lib/content";
import { ResearchRequest } from "../types";
import { filterRequestsForCurrentUser } from "../lib/requestAccess";
import {
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Upload,
  X,
  MessageSquare,
  Send,
  ShieldCheck,
  GitBranch,
  ChevronRight,
  Clock,
  Paperclip,
} from "lucide-react";

interface ReviewDetail {
  id: string;
  requestNumber: string;
  title: string;
  status: ResearchRequest["status"];
  dateCompleted: string | null;
  dateSubmitted: string;
  deadline: string;
  priority: string;
  reports: {
    id: string;
    title: string;
    version: number;
    isDraft: boolean;
    isApproved: boolean;
    approvedAt: string | null;
    createdAt: string;
    content: string | null;
    author: { id: string; firstName: string; lastName: string; initials: string };
    versions: { id: string; version: number; notes: string | null; createdAt: string }[];
  }[];
  comments: {
    id: string;
    text: string;
    section: string | null;
    resolved: boolean;
    createdAt: string;
    author: { id: string; firstName: string; lastName: string; initials: string; title: string };
  }[];
  attachments: {
    id: string;
    name: string;
    fileType: string;
    fileSize: number | null;
    createdAt: string;
    uploader: { id: string; firstName: string; lastName: string };
  }[];
}

const REVIEW_STATUSES = ["DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED", "APPROVED"];

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT_SUBMITTED: { label: "Draft Submitted", color: "bg-blue-100 text-blue-800" },
  REVISION_REQUESTED: { label: "Revision Requested", color: "bg-orange-100 text-orange-800" },
  REVISED: { label: "Revised", color: "bg-indigo-100 text-indigo-800" },
  APPROVED: { label: "Approved", color: "bg-emerald-100 text-emerald-800" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export const MemberResearchReviewView: React.FC = () => {
  const { requests, currentUser, requestRevisionForRequest, approveRequestForReview, addComment } = useApp();
  const { toast } = useToast();

  const memberRequests = filterRequestsForCurrentUser(requests, currentUser);
  const reviewRequests = memberRequests.filter((r) => REVIEW_STATUSES.includes(r.status));

  const [selectedId, setSelectedId] = useState<string>(reviewRequests[0]?.id || "");
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const selectedRequest = reviewRequests.find((r) => r.id === selectedId) || reviewRequests[0];

  const loadDetail = useCallback(async (requestId: string) => {
    if (!requestId) return;
    setLoading(true);
    try {
      const [detailData, reviews] = await Promise.all([
        getRequest(requestId),
        getReviews(requestId),
      ]);
      setDetail(detailData);
      if (reviews?.length) {
        setDetail((prev) => (prev ? { ...prev, comments: reviews } : prev));
      }
    } catch {
      toast.error("Failed to load review details");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDetail(selectedRequest?.id || "");
  }, [selectedRequest?.id, loadDetail]);

  const latestReport = detail?.reports?.find((r) => r.id === detail.reports[0]?.id) || detail?.reports?.[0];
  const previewText = toPlainText(latestReport?.content);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRequest) return;
    const err = validateUploadFile(file);
    if (err) {
      toast.error(err);
      e.target.value = "";
      return;
    }
    uploadFile(selectedRequest.id, file)
      .then(() => {
        toast.success(`"${file.name}" uploaded successfully.`);
        loadDetail(selectedRequest.id);
      })
      .catch((err: any) => toast.error(err?.message || "Failed to upload file"));
    e.target.value = "";
  };

  const handleRemoveAttachment = async (file: any) => {
    if (!file?.id || !selectedRequest) return;
    try {
      await deleteAttachment(file.id);
      toast.success(`"${file.name}" removed.`);
      loadDetail(selectedRequest.id);
    } catch (err: any) {
      toast.error(err?.message || `Failed to remove "${file.name}"`);
    }
  };

  const handleAccept = async () => {
    if (!selectedRequest || !selectedRequest.reportId) {
      toast.error("No report is available to accept");
      return;
    }
    setAccepting(true);
    try {
      await approveRequestForReview(selectedRequest.id);
      toast.success("Research brief accepted. The brief is now final and read-only.");
      setConfirmAcceptId(null);
      loadDetail(selectedRequest.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept the brief");
    } finally {
      setAccepting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedRequest || !selectedRequest.reportId) {
      toast.error("No report is available to revise");
      return;
    }
    if (!revisionText.trim()) {
      toast.error("Please describe the revisions you need");
      return;
    }
    setRevisionSubmitting(true);
    try {
      await requestRevisionForRequest(selectedRequest.id, revisionText);
      addComment(selectedRequest.id, revisionText, "Revision Request");
      toast.success("Revision requested. The research team has been notified.");
      setRevisionOpen(false);
      setRevisionText("");
      loadDetail(selectedRequest.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to request revision");
    } finally {
      setRevisionSubmitting(false);
    }
  };

  const handleFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !selectedRequest) return;
    addComment(selectedRequest.id, feedbackText);
    setFeedbackText("");
    toast.success("Your directive has been appended to the request timeline.");
  };

  const isAwaitingReview = selectedRequest && ["DRAFT_SUBMITTED", "REVISED"].includes(selectedRequest.status);
  const isApproved = selectedRequest?.status === "APPROVED";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">
          Research Review Center
        </h2>
        <p className="font-sans text-sm text-[#434655] mt-1">
          Preview submitted briefs, request revisions, or accept the final research brief, {honourable(currentUser.name)}.
        </p>
      </div>

      {reviewRequests.length === 0 ? (
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-16 text-center space-y-4">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-bold text-gray-900">No research briefs awaiting your review</h3>
          <p className="text-sm text-[#434655] max-w-md mx-auto">
            When a research officer submits a draft, it will appear here for you to review, request revisions, or accept.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Left: list of briefs awaiting review */}
          <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-center justify-between">
              <h4 className="font-sans font-bold text-sm text-[#191c1d]">Briefs for Review</h4>
              <span className="text-xs bg-[#dce1ff] text-[#0039b5] px-2.5 py-0.5 rounded-full font-bold">
                {reviewRequests.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100 flex-1 overflow-y-auto max-h-150">
              {reviewRequests.map((req) => {
                const isSelected = req.id === selectedRequest?.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedId(req.id)}
                    className={`p-4 cursor-pointer transition-colors relative text-left hover:bg-gray-50/50 ${isSelected ? "bg-blue-50/30" : ""}`}
                  >
                    {isSelected && <div className="absolute left-0 top-0 w-1 h-full bg-[#0037b0]" />}
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold text-gray-400">{req.id}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${STATUS_META[req.status]?.color || "bg-gray-100 text-gray-600"}`}>
                        {req.status === "REVISION_REQUESTED" ? "Revision Requested" : req.status === "REVISED" ? "Revised" : req.status === "APPROVED" ? "Approved" : "Draft Submitted"}
                      </span>
                    </div>
                    <h5 className="font-semibold text-xs text-gray-900 mt-1.5 leading-snug">{req.title}</h5>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {req.deadline}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#0037b0]" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: review detail */}
          <div className="lg:col-span-2 space-y-6">
            {selectedRequest && (
              <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="bg-[#dce1ff] text-[#0039b5] font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                        {selectedRequest.id}
                      </span>
                      <h3 className="font-sans font-bold text-gray-900 text-sm">{selectedRequest.title}</h3>
                    </div>
                    <span className={`inline-block w-fit px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_META[selectedRequest.status]?.color || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_META[selectedRequest.status]?.label || formatRequestStatus(selectedRequest.status)}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0037b0]" />
                    </div>
                  ) : detail ? (
                    <>
                      {/* Milestones */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Submitted", date: detail.dateSubmitted },
                          { label: "Deadline", date: detail.deadline },
                          { label: "Approved", date: detail.dateCompleted },
                        ].map((m) => (
                          <div key={m.label} className={`rounded-lg p-2.5 text-center border ${m.date ? "bg-blue-50/50 border-blue-100" : "bg-gray-50 border-gray-100"}`}>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{m.label}</p>
                            <p className={`text-xs font-bold mt-0.5 ${m.date ? "text-gray-900" : "text-gray-400"}`}>
                              {m.label === "Approved" ? formatDateTime(m.date) : formatDate(m.date)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Accepted banner — read-only */}
                      {isApproved && (
                        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-emerald-800">Research brief approved</p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              Approved on {formatDateTime(detail.dateCompleted)}. This brief is final and read-only — the latest version remains available for download.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Latest report */}
                      {latestReport ? (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <GitBranch className="w-3.5 h-3.5" /> Latest Research Brief
                          </h4>
                          <div className="bg-gray-50 border border-[#c4c5d7] rounded-lg overflow-hidden">
                            <div className="px-4 py-3 border-b border-[#c4c5d7] flex items-center justify-between bg-white">
                              <div className="flex items-center gap-2">
                                <span className="bg-[#dce1ff] text-[#0039b5] text-[10px] font-bold px-2 py-0.5 rounded">
                                  v{latestReport.version}
                                </span>
                                <span className="text-xs font-bold text-gray-900">{latestReport.title}</span>
                              </div>
                              <span className="text-[10px] text-gray-500">
                                by {latestReport.author.firstName} {latestReport.author.lastName} &middot; {formatDate(latestReport.createdAt)}
                              </span>
                            </div>
                            {previewText ? (
                              <div className="p-5 max-h-96 overflow-y-auto">
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{previewText}</p>
                              </div>
                            ) : (
                              <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
                                The brief was uploaded as a file. Use the download button below to view it.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-xs text-gray-400 italic">
                          No research brief has been submitted yet.
                        </div>
                      )}

                      {/* Report versions */}
                      {latestReport?.versions && latestReport.versions.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {latestReport.versions.map((v) => (
                            <span key={v.id} className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              v{v.version}{v.notes ? ` — ${v.notes}` : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Attachments */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5" /> Attachments
                        </h4>
                        <div className="space-y-2">
                          {detail.attachments.map((file) => (
                            <div key={file.id} className="bg-white border border-[#c4c5d7] rounded-lg p-3 flex items-center justify-between shadow-sm">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  {file.fileType}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 truncate">{file.name}</p>
                                  <p className="text-[10px] text-gray-500">
                                    {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : ""}
                                    {file.uploader ? ` · by ${file.uploader.firstName} ${file.uploader.lastName}` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {(currentUser.role === "ADMIN" || file.uploader?.id === currentUser.id) && (
                                  <button
                                    onClick={() => handleRemoveAttachment(file)}
                                    className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                    title="Remove file"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => downloadFile(file.id, file.name).catch(() => toast.error(`Failed to download "${file.name}"`))}
                                  className="p-1.5 hover:bg-gray-100 rounded text-gray-700 hover:text-[#0037b0] transition-colors cursor-pointer"
                                  title="Download"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {detail.attachments.length === 0 && (
                            <p className="text-[11px] text-gray-400 italic">No attached documents yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Upload additional document */}
                      {!isApproved && (
                        <div className="border-t border-gray-100 pt-4">
                          <input
                            type="file"
                            id="review-upload"
                            className="hidden"
                            accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.rtf,.odt,.zip"
                            onChange={handleUpload}
                          />
                          <button
                            onClick={() => document.getElementById("review-upload")?.click()}
                            className="w-full bg-white border border-dashed border-[#0037b0] text-[#0037b0] hover:bg-blue-50 text-xs font-semibold py-2.5 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Supporting Document (PDF, DOCX, XLSX, PPTX, TXT, CSV, RTF, ODT, ZIP — max 50MB)</span>
                          </button>
                        </div>
                      )}

                      {/* Comments */}
                      {detail.comments.length > 0 && (
                        <div className="border-t border-gray-100 pt-4 space-y-3">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" /> Comments &amp; Feedback
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {detail.comments.map((comment) => (
                              <div key={comment.id} className={`rounded-lg p-3 border ${comment.resolved ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-[#c4c5d7]"}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-[#515f74] text-white flex items-center justify-center text-[9px] font-bold">
                                      {comment.author.initials}
                                    </div>
                                    <span className="text-xs font-bold text-gray-900">
                                      {comment.author.title ? `${comment.author.title} ` : ""}
                                      {comment.author.firstName} {comment.author.lastName}
                                    </span>
                                    {comment.section && (
                                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{comment.section}</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-400">{formatRelativeTime(comment.createdAt)}</span>
                                </div>
                                <p className="text-xs text-gray-700 mt-2 leading-relaxed">{comment.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Review actions */}
                      {isAwaitingReview && (
                        <div className="border-t border-gray-100 pt-5 flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => setRevisionOpen(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[#b45309] text-[#b45309] text-xs font-bold rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Request Revision
                          </button>
                          <button
                            onClick={() => setConfirmAcceptId(selectedRequest.id)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#006b2c] text-white text-xs font-bold rounded-lg hover:bg-[#005a25] transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Accept Brief
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-16 text-center text-sm text-gray-500">No details available.</div>
                  )}
                </div>
              </div>
            )}

            {/* Directive / feedback */}
            {selectedRequest && !isApproved && (
              <form onSubmit={handleFeedback} className="bg-white border border-[#c4c5d7] rounded-lg p-5 space-y-3">
                <h5 className="font-sans font-bold text-xs text-gray-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#0037b0]" />
                  Add Directive / Feedback
                </h5>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Ask for focus updates, comment on scope, or add guidance for the research team..."
                  className="w-full bg-white border border-[#c4c5d7] rounded p-2 text-xs h-20 outline-none focus:ring-1 focus:ring-[#0037b0]"
                />
                <button
                  type="submit"
                  className="w-full bg-[#515f74] hover:bg-[#3a485c] text-white text-xs font-semibold py-2 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Memo</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Request Revision Modal */}
      {revisionOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRevisionOpen(false)}>
          <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center">
              <div>
                <h3 className="font-sans font-bold text-gray-900 text-sm">Request Revision</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{selectedRequest.id} — {selectedRequest.title}</p>
              </div>
              <button onClick={() => setRevisionOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-600">
                Describe the changes you need. The research team and administrators will be notified, and the brief will be returned for revision.
              </p>
              <textarea
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                rows={5}
                autoFocus
                placeholder="e.g., Please expand the fiscal impact section and include more recent data..."
                className="w-full border border-[#c4c5d7] rounded p-3 text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
              />
            </div>
            <div className="px-6 py-4 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-end gap-2">
              <button onClick={() => setRevisionOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={revisionSubmitting || !revisionText.trim()}
                className="px-4 py-2 text-xs font-semibold bg-[#b45309] text-white rounded hover:bg-[#92400e] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {revisionSubmitting ? "Requesting..." : "Request Revision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Confirmation Modal */}
      {confirmAcceptId && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmAcceptId(null)}>
          <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-sans font-bold text-gray-900 text-sm">Accept Research Brief</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{selectedRequest.title}</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-xs text-gray-600 leading-relaxed">
                Accepting this brief marks it as <strong>final and approved</strong>. The acceptance date and time will be recorded, and the brief becomes read-only. The research team will be notified.
              </p>
            </div>
            <div className="px-6 py-4 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-end gap-2">
              <button onClick={() => setConfirmAcceptId(null)} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="px-4 py-2 text-xs font-semibold bg-[#006b2c] text-white rounded hover:bg-[#005a25] transition-colors cursor-pointer disabled:opacity-50"
              >
                {accepting ? "Accepting..." : "Confirm Accept"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
