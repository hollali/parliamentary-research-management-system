import React, { useState, useEffect, useRef, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../lib/toast";
import { formatRequestStatus } from "../lib/status";
import {
  acceptAssignment,
  declineAssignment,
  uploadFile,
  deleteAttachment,
  getMyAssignments,
} from "../lib/api";
import { honourable } from "../lib/format";
import { ResearchRequest } from "../types";
import {
  Inbox,
  Clock,
  AlertTriangle,
  User,
  Paperclip,
  ArrowRight,
  ChevronRight,
  Upload,
  FileText,
  Database,
  BookOpen,
  Send,
  Sparkles,
  Edit,
  CheckCircle2,
  XCircle,
  X,
  Trash2,
} from "lucide-react";

interface OfficerWorkflowViewProps {
  onNavigate: (view: string, targetId?: string) => void;
  initialRequestId?: string;
}

export const OfficerWorkflowView: React.FC<OfficerWorkflowViewProps> = ({
  onNavigate,
  initialRequestId,
}) => {
  const { currentUser, requests, updateRequestStatus, refreshRequests } =
    useApp();
  const { toast } = useToast();

  // Officer's assigned requests — backend already filters by role (direct, assignment, or team)
  const officerRequests = requests.filter(
    (r) => !["APPROVED", "DELIVERED", "CLOSED"].includes(r.status),
  );

  const shortId = (id: string) => (id.length > 8 ? `O#${id.slice(0, 8)}` : id);

  const requestDeadlineInfo = (req: ResearchRequest) => {
    const t = req.deadline ? new Date(req.deadline).getTime() : NaN;
    if (Number.isNaN(t)) {
      return { kind: "none" as const };
    }
    const diffDays = Math.ceil((t - Date.now()) / 86400000);
    if (req.status === "OVERDUE" || diffDays < 0) {
      return { kind: "overdue" as const, days: Math.abs(diffDays) };
    }
    if (diffDays === 0) return { kind: "today" as const };
    return { kind: "ok" as const, days: diffDays };
  };

  const dueTodayCount = useMemo(
    () =>
      officerRequests.filter((r) => requestDeadlineInfo(r).kind === "today")
        .length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officerRequests],
  );
  const overdueCount = useMemo(
    () =>
      officerRequests.filter((r) => requestDeadlineInfo(r).kind === "overdue")
        .length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officerRequests],
  );
  const urgentCount = useMemo(
    () => officerRequests.filter((r) => r.priority === "URGENT").length,
    [officerRequests],
  );

  const sortedRequests = useMemo(
    () =>
      [...officerRequests].sort((a, b) => {
        const apr = requestDeadlineInfo(a).kind === "overdue" ? 0 : 1;
        const bpr = requestDeadlineInfo(b).kind === "overdue" ? 0 : 1;
        if (apr !== bpr) return apr - bpr;
        const at = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bt = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return at - bt;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officerRequests],
  );

  const fileIconColor = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return "text-red-500";
    if (["docx", "doc", "rtf", "odt", "txt"].includes(ext))
      return "text-blue-500";
    if (["xlsx", "xls", "csv"].includes(ext)) return "text-emerald-600";
    if (["pptx", "ppt"].includes(ext)) return "text-orange-500";
    return "text-indigo-500";
  };

  const [selectedId, setSelectedId] = useState<string>(
    initialRequestId || officerRequests[0]?.id || requests[0]?.id || "",
  );
  const appliedInitialRef = useRef(false);

  // Select the request the officer was pointed to once it becomes available
  useEffect(() => {
    if (!appliedInitialRef.current && initialRequestId) {
      if (requests.some((r) => r.id === initialRequestId)) {
        setSelectedId(initialRequestId);
        appliedInitialRef.current = true;
      }
    }
  }, [initialRequestId, requests]);
  const [decliningFor, setDecliningFor] = useState<ResearchRequest | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const activeRequest =
    officerRequests.find((r) => r.id === selectedId) ||
    officerRequests[0] ||
    requests.find((r) => r.id === selectedId) ||
    requests[0] ||
    null;

  const handleStatusChange = (status: ResearchRequest["status"]) => {
    updateRequestStatus(activeRequest.id, status);
  };

  const findMyAssignment = (data: any, request: ResearchRequest) => {
    const assignments = Array.isArray(data) ? data : data?.assignments || [];
    if (!Array.isArray(assignments)) return null;
    const candidates = assignments.filter(
      (a: any) =>
        a.id &&
        !a.declinedAt &&
        !a.supersededAt &&
        (a.request?.requestNumber === request.id ||
          a.requestId === request.id),
    );
    // Prefer a direct assignment over a team assignment so Accept doesn't
    // fail with 403 when the officer is both a team member and a direct assignee.
    const direct = candidates.find(
      (a: any) => a.assignedToId === currentUser.id,
    );
    return direct || candidates[0] || null;
  };

  const handleAccept = async () => {
    try {
      const data = (await getMyAssignments()) as any;
      const myAssignment = findMyAssignment(data, activeRequest);
      if (myAssignment) {
        await acceptAssignment(myAssignment.id);
        toast.success("Assignment accepted");
        handleStatusChange("IN_PROGRESS");
      } else {
        handleStatusChange("IN_PROGRESS");
        toast.success("Request moved to In Progress");
      }
    } catch {
      toast.error("Failed to accept assignment");
    }
  };

  const handleDecline = () => {
    setDeclineReason("");
    setDecliningFor(activeRequest);
  };

  const confirmDecline = async () => {
    if (!decliningFor) return;
    setDeclining(true);
    try {
      const data = (await getMyAssignments()) as any;
      const myAssignment = findMyAssignment(data, decliningFor);
      if (!myAssignment) {
        toast.info("Assignment not found or already processed");
        setDecliningFor(null);
        return;
      }
      await declineAssignment(myAssignment.id, declineReason || undefined);
      toast.success("Assignment declined");
      setSelectedId(
        officerRequests.filter((r) => r.id !== decliningFor.id)[0]?.id || "",
      );
      setDecliningFor(null);
    } catch {
      toast.error("Failed to decline assignment");
    } finally {
      setDeclining(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropDraft = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    for (const file of files) {
      try {
        await uploadFile(activeRequest.id, file);
        toast.success(`"${file.name}" uploaded successfully.`);
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
      }
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    for (const file of files) {
      try {
        await uploadFile(activeRequest.id, file);
        toast.success(`"${file.name}" uploaded successfully.`);
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
      }
    }
    e.target.value = "";
  };

  const handleRemoveAttachment = async (attachment: any) => {
    if (!attachment?.id) {
      toast.error("This file cannot be removed yet.");
      return;
    }
    try {
      await deleteAttachment(attachment.id);
      toast.success(`"${attachment.name}" removed.`);
      refreshRequests();
    } catch (err: any) {
      toast.error(err?.message || `Failed to remove "${attachment.name}"`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">
            Officer Workflow
          </h2>
          <p className="font-sans text-sm text-[#434655] mt-1.5">
            Manage assigned requests, review feedback, and upload final
            briefings.
          </p>
        </div>
        <button
          onClick={() => onNavigate("briefs")}
          className="hidden md:flex items-center gap-2 text-[#0037b0] text-sm font-bold hover:underline"
        >
          View briefs
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#dce1ff] text-[#0039b5] px-3 py-1.5 rounded-full">
          <Inbox className="w-3.5 h-3.5" /> {officerRequests.length} Active
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ${overdueCount > 0 ? "bg-[#ffdad6] text-[#93000a]" : "bg-[#edeeef] text-gray-500"}`}>
          <AlertTriangle className="w-3.5 h-3.5" /> {overdueCount} Overdue
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ${dueTodayCount > 0 ? "bg-amber-100 text-amber-800" : "bg-[#edeeef] text-gray-500"}`}>
          <Clock className="w-3.5 h-3.5" /> {dueTodayCount} Due today
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full ${urgentCount > 0 ? "bg-[#ffdad6] text-[#93000a]" : "bg-[#edeeef] text-gray-500"}`}>
          <Sparkles className="w-3.5 h-3.5" /> {urgentCount} Urgent
        </span>
      </div>

      {/* Main split dashboard panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left Column: Daily Assignments Inbox List */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-center justify-between">
            <h4 className="font-sans font-bold text-sm text-[#191c1d] flex items-center gap-1.5">
              <Inbox className="w-4.5 h-4.5 text-[#0037b0]" /> Daily Assignments
            </h4>
            <span className="text-xs bg-[#dce1ff] text-[#0039b5] px-2.5 py-0.5 rounded-full font-bold">
              {officerRequests.length} Active
            </span>
          </div>

          {officerRequests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 px-6 text-center">
              <Inbox className="w-8 h-8 text-gray-300" />
              <p className="text-sm font-bold text-gray-500">
                No active assignments
              </p>
              <p className="text-xs text-gray-400">
                New requests assigned to you will appear here.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-125 p-2.5 space-y-2">
              {sortedRequests.map((req) => {
                const isSelected = req.id === selectedId;
                const d = requestDeadlineInfo(req);
                const isOverdue = d.kind === "overdue";
                return (
                  <button
                    key={req.id}
                    onClick={() => setSelectedId(req.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#0037b0] bg-[#eef3ff] shadow-sm ring-1 ring-[#0037b0]/15"
                        : isOverdue
                          ? "border-[#ffb4ab] bg-[#fff8f7] hover:border-[#ba1a1a]/50 hover:shadow-sm"
                          : "border-[#c4c5d7] bg-white hover:border-[#0037b0]/40 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-gray-400">
                        {shortId(req.id)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isOverdue && (
                          <span className="text-[9px] font-bold text-white bg-[#ba1a1a] rounded-full px-1.5 py-0.5 inline-flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Overdue {d.days}d
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            req.priority === "URGENT"
                              ? "bg-[#ffdad6] text-[#93000a]"
                              : "bg-[#edeeef] text-gray-600"
                          }`}
                        >
                          {req.priority}
                        </span>
                      </div>
                    </div>
                    <h5 className="font-semibold text-xs text-gray-900 leading-snug">
                      {req.title}
                    </h5>
                    {req.category && (
                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                        {req.category}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold ${isOverdue ? "text-[#ba1a1a]" : "text-gray-400"}`}>
                        <Clock className="w-3 h-3" /> {req.deadline}
                        {d.kind === "today" && (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5">Due today</span>
                        )}
                      </span>
                      <span
                        className={`uppercase text-[10px] font-bold ${
                          req.status === "OVERDUE" ? "text-[#ba1a1a]" : "text-[#0037b0]"
                        }`}
                      >
                        {formatRequestStatus(req.status)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!activeRequest && (
          <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg shadow-sm p-14 flex flex-col items-center justify-center text-center gap-2">
            <Sparkles className="w-10 h-10 text-gray-300" />
            <p className="text-sm font-bold text-gray-600">
              No assignment selected
            </p>
            <p className="text-xs text-gray-400 max-w-sm">
              Select an active assignment from the list to see details, upload
              briefings, and manage its progress.
            </p>
          </div>
        )}

        {/* Right Columns: Active Assignment details & draft zone */}
        {activeRequest && (
          <div className="lg:col-span-2 space-y-6">
            {/* Detailed details board */}
            <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm space-y-6">
              <header className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-[#dce1ff] text-[#0039b5] font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                      {shortId(activeRequest.id)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        activeRequest.priority === "URGENT"
                          ? "bg-[#ffdad6] text-[#93000a]"
                          : "bg-[#edeeef] text-gray-600"
                      }`}
                    >
                      {activeRequest.priority}
                    </span>
                    {requestDeadlineInfo(activeRequest).kind === "overdue" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white bg-[#ba1a1a] rounded-full px-1.5 py-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Overdue {requestDeadlineInfo(activeRequest).days}d
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-1.5">
                    {activeRequest.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requested by:{" "}
                    <span className="font-bold text-gray-700">
                      {honourable(activeRequest.member)}
                    </span>
                    {" · "}Due{" "}
                    <span className="font-bold text-gray-700">
                      {activeRequest.deadline}
                    </span>
                  </p>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-2">
                  {activeRequest.status === "ASSIGNED" ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAccept}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#006b2c] text-white text-xs font-bold rounded-lg hover:bg-[#005a25] transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={handleDecline}
                        className="flex items-center gap-1.5 px-3 py-2 border border-[#ba1a1a] text-[#ba1a1a] text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs text-gray-500 font-semibold">
                        Active Status:
                      </span>
                      <select
                        value={activeRequest.status}
                        onChange={(e) =>
                          handleStatusChange(
                            e.target.value as ResearchRequest["status"],
                          )
                        }
                        className="text-xs font-bold bg-[#f3f4f5] border border-[#c4c5d7] p-2 rounded-lg outline-none focus:ring-1 focus:ring-[#0037b0] text-gray-800"
                      >
                        <option value="ASSIGNED">Assigned</option>
                        <option value="IN_PROGRESS">In Progress</option>
                      </select>
                    </>
                  )}
                </div>
              </header>

              {/* Request Description */}
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-gray-400" /> Request Scope Description
                </h5>
                <p className="text-xs text-gray-700 leading-relaxed bg-[#f3f4f5]/50 p-4 rounded-lg">
                  {activeRequest.description}
                </p>
              </div>

              {/* Key Stakeholders & Data references */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Key
                    Stakeholders
                  </h6>
                  <p className="text-xs text-[#434655] font-semibold">
                    {activeRequest.keyStakeholders ||
                      "Ministry representatives, local municipal coordinators."}
                  </p>
                </div>
                <div className="space-y-1">
                  <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-gray-400" />{" "}
                    Authorized Data Sources
                  </h6>
                  <p className="text-xs text-[#434655] font-semibold">
                    {activeRequest.dataSources ||
                      "National Bureau of Statistics, Geo-spatial regional metrics."}
                  </p>
                </div>
              </div>

              {/* Revision Editor shortcut trigger button */}
              <div className="bg-[#dce1ff]/30 border border-[#0037b5]/20 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-[#0039b5] flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />{" "}
                    Document Draft Workspace
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Write and format your research brief draft directly inside
                    the secure editor.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate("workspace", activeRequest.id)}
                  className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1 shadow-sm transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Open Editor</span>
                </button>
              </div>

              {/* Draft Upload Zone */}
              <div className="space-y-3.5 border-t border-gray-100 pt-5">
                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-gray-400" /> Briefing
                  Attachment Slots
                </h5>

                {/* Upload dash area */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropDraft}
                  onClick={() =>
                    document.getElementById("officer-brief-file")?.click()
                  }
                  className="border-2 border-dashed border-[#c4c5d7] hover:border-[#0037b0] bg-gray-50/50 hover:bg-gray-100/50 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                >
                  <input
                    id="officer-brief-file"
                    type="file"
                    accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.rtf,.odt,.zip"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Upload className="w-5 h-5 text-gray-400" />
                  <p className="text-xs font-bold text-gray-900">
                    Drag & drop files here to attach
                  </p>
                  <p className="text-[9px] text-gray-500">
                    Supports PDF, DOCX, XLSX, PPTX, TXT, CSV, RTF, ODT, ZIP up to 50MB. Files are verified
                    for active security compliance.
                  </p>
                </div>

                {/* Attached files rows */}
                {activeRequest.attachments.length > 0 && (
                  <div className="space-y-2.5">
                    {activeRequest.attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-[#c4c5d7] rounded-lg p-2.5 flex justify-between items-center text-xs shadow-sm"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className={`w-4.5 h-4.5 ${fileIconColor(file.name)}`} />
                          <span className="font-semibold text-gray-900">
                            {file.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 font-bold">
                            {file.size}
                          </span>
                          <button
                            onClick={() => handleRemoveAttachment(file)}
                            className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Admin reviews feedback board summary */}
              {activeRequest.comments.length > 0 && (
                <div className="space-y-3 border-t border-gray-100 pt-5">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Review Comments & Feedbacks
                  </h5>
                  <div className="space-y-3">
                    {activeRequest.comments.map((c) => (
                      <div
                        key={c.id}
                        className={`p-3 rounded border text-xs ${c.resolved ? "bg-emerald-50/40 border-emerald-200" : "bg-amber-50/40 border-amber-200"}`}
                      >
                        <div className="flex justify-between font-bold text-gray-900 mb-1">
                          <span className="flex items-center gap-1.5">
                            {c.userName} ({c.role})
                            {c.resolved && (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5 uppercase tracking-wider">
                                Resolved
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {c.time}
                          </span>
                        </div>
                        <p className="text-gray-600 leading-normal italic">
                          "{c.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {decliningFor && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] px-4 overflow-y-auto"
          onClick={() => {
            if (!declining) setDecliningFor(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Decline assignment: ${decliningFor.title}`}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#ba1a1a] flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Decline Assignment
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                  {decliningFor.title}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!declining) setDecliningFor(null);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label="Close"
                disabled={declining}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Reason (optional)
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Tell the admin why you cannot take this assignment…"
                  rows={4}
                  disabled={declining}
                  className="w-full bg-white border border-[#c4c5d7] rounded-lg p-3 text-xs outline-none focus:ring-1 focus:ring-[#ba1a1a] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    if (!declining) setDecliningFor(null);
                  }}
                  disabled={declining}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDecline}
                  disabled={declining}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {declining ? "Declining…" : "Confirm Decline"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
