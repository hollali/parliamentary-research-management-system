import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../lib/toast";
import {
  getDownloadUrl,
  downloadFile,
  uploadFile,
  getRequest,
  getRequestActivity,
} from "../lib/api";
import { honourable } from "../lib/format";
import { ResearchRequest } from "../types";
import { useDialogA11y } from "../lib/useDialogA11y";
import { filterRequestsForCurrentUser } from "../lib/requestAccess";
import { Pagination } from "./Pagination";
import {
  Clock,
  Award,
  FileCheck,
  Download,
  ChevronRight,
  Send,
  Upload,
  X,
  User,
  Activity,
  MessageSquare,
  GitBranch,
  Calendar,
  CheckCircle2,
  BadgeCheck,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Gauge,
} from "lucide-react";

interface DetailedRequest {
  id: string;
  title: string;
  status: ResearchRequest["status"];
  priority: string;
  deadline: string;
  dateSubmitted: string;
  dateAssigned: string | null;
  dateCompleted: string | null;
  dateDelivered: string | null;
  dateClosed: string | null;
  memberConfirmedAt: string | null;
  memberConfirmationNote: string | null;
  draftVersion: number;
  category: { id: string; name: string };
  submitter: {
    id: string;
    firstName: string;
    lastName: string;
    initials: string;
    title: string;
  };
  officer: {
    id: string;
    firstName: string;
    lastName: string;
    initials: string;
    title: string;
  } | null;
  reports: {
    id: string;
    title: string;
    version: number;
    isDraft: boolean;
    isApproved: boolean;
    createdAt: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      initials: string;
    };
    versions: {
      id: string;
      version: number;
      notes: string | null;
      createdAt: string;
    }[];
  }[];
  comments: {
    id: string;
    text: string;
    section: string | null;
    resolved: boolean;
    createdAt: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      initials: string;
      title: string;
    };
  }[];
  attachments: {
    id: string;
    name: string;
    fileType: string;
    fileSize: number | null;
  }[];
  assignments: {
    id: string;
    notes: string | null;
    deadline: string;
    acceptedAt: string | null;
    declinedAt: string | null;
    supersededAt: string | null;
    createdAt: string;
    assignedBy: { id: string; firstName: string; lastName: string };
    assignedTo: { id: string; firstName: string; lastName: string } | null;
  }[];
}

interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata: any;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    initials: string;
  } | null;
}

const PROGRESS_MAP: Record<string, number> = {
  SUBMITTED: 10,
  ASSIGNED: 25,
  IN_PROGRESS: 50,
  DRAFT_SUBMITTED: 65,
  REVISION_REQUESTED: 70,
  REVISED: 75,
  APPROVED: 90,
  DELIVERED: 95,
  MEMBER_CONFIRMED: 100,
  CLOSED: 100,
  OVERDUE: 40,
};

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-[#dce1ff] text-[#0039b5]",
  DRAFT_SUBMITTED: "bg-amber-100 text-amber-800",
  REVISION_REQUESTED: "bg-orange-100 text-orange-800",
  REVISED: "bg-orange-100 text-orange-800",
  OVERDUE: "bg-[#ffdad6] text-[#93000a]",
  APPROVED: "bg-teal-100 text-teal-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  MEMBER_CONFIRMED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-emerald-100 text-emerald-800",
};

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  ASSIGNED: "Assigned",
  STATUS_CHANGED: "Status Changed",
  FILE_UPLOADED: "File Uploaded",
  COMMENT_ADDED: "Comment Added",
  APPROVED: "Approved",
  MEMBER_CONFIRMED: "Member Confirmed",
  REJECTED: "Rejected",
  DEACTIVATED: "Deactivated",
};

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
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemaining(deadline: string): {
  days: number;
  label: string;
  color: string;
} {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0)
    return {
      days: Math.abs(days),
      label: `${Math.abs(days)}d overdue`,
      color: "text-red-600 bg-red-50",
    };
  if (days === 0)
    return { days: 0, label: "Due today", color: "text-amber-700 bg-amber-50" };
  if (days <= 3)
    return {
      days,
      label: `${days}d remaining`,
      color: "text-amber-600 bg-amber-50",
    };
  if (days <= 7)
    return {
      days,
      label: `${days}d remaining`,
      color: "text-blue-600 bg-blue-50",
    };
  return {
    days,
    label: `${days}d remaining`,
    color: "text-emerald-600 bg-emerald-50",
  };
}

function extendDeadlineStr(currentDeadline: string, days: number): string {
  let d: Date;
  try {
    d = new Date(currentDeadline);
    if (isNaN(d.getTime())) d = new Date();
  } catch {
    d = new Date();
  }
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const isClosedStatus = (status: ResearchRequest["status"]) =>
  ["APPROVED", "DELIVERED", "MEMBER_CONFIRMED", "CLOSED"].includes(status);

// A brief an admin has approved and sent to the member is waiting on the
// member to either sign off or send it back with feedback.
const AWAITING_MEMBER_STATUSES = ["APPROVED", "DELIVERED"];

export const MemberDashboardView: React.FC = () => {
  const { requests, currentUser, addComment, updateRequestPriority, refreshRequests, extendRequestDeadline, requestRevisionForRequest, confirmMemberSatisfaction } = useApp();
  const { toast } = useToast();
  const memberRequests = filterRequestsForCurrentUser(requests, currentUser);

  const shortId = (id: string) => (id.length > 8 ? `R#${id.slice(0, 8)}` : id);

  const overdueCount = memberRequests.filter(
    (r) =>
      !isClosedStatus(r.status) &&
      (r.status === "OVERDUE" ||
        (r.deadline && new Date(r.deadline).getTime() < Date.now())),
  ).length;

  const urgentCount = memberRequests.filter(
    (r) =>
      !isClosedStatus(r.status) &&
      r.priority === "URGENT",
  ).length;

  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    memberRequests[0]?.id || requests[0]?.id || "",
  );

  const [feedbackText, setFeedbackText] = useState("");
  const [isExpedited, setIsExpedited] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackText, setSendBackText] = useState("");
  const [sendingBack, setSendingBack] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNote, setConfirmNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [trackingModalRequest, setTrackingModalRequest] =
    useState<ResearchRequest | null>(null);
  const trackingDialogRef = useDialogA11y<HTMLDivElement>({
    onClose: () => setTrackingModalRequest(null),
    enabled: !!trackingModalRequest,
  });
  const confirmDialogRef = useDialogA11y<HTMLDivElement>({
    onClose: () => setConfirmOpen(false),
    enabled: confirmOpen,
  });

  const [extendMenuOpenId, setExtendMenuOpenId] = useState<string | null>(null);
  const extendMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!extendMenuOpenId) return;
    const onDown = (e: MouseEvent) => {
      if (
        extendMenuRef.current &&
        !extendMenuRef.current.contains(e.target as Node)
      ) {
        setExtendMenuOpenId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExtendMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [extendMenuOpenId]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(
    1,
    Math.ceil(memberRequests.length / pageSize),
  );
  const currentPageClamped = Math.min(currentPage, totalPages);
  const paginatedRequests = memberRequests.slice(
    (currentPageClamped - 1) * pageSize,
    currentPageClamped * pageSize,
  );

  // Modal detail data
  const [detail, setDetail] = useState<DetailedRequest | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const activeRequest =
    requests.find((r) => r.id === selectedRequestId) || requests[0];

  // Fetch detailed data when modal opens
  const fetchModalData = useCallback(
    async (requestId: string) => {
      setDetailLoading(true);
      try {
        const [detailData, activityData] = await Promise.all([
          getRequest(requestId),
          getRequestActivity(requestId),
        ]);
        setDetail(detailData);
        setActivityLogs(activityData);
      } catch {
        toast.error("Failed to load request details");
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (trackingModalRequest) {
      fetchModalData(trackingModalRequest.id);
      setSendBackOpen(false);
      setSendBackText("");
    } else {
      setDetail(null);
      setActivityLogs([]);
    }
  }, [trackingModalRequest, fetchModalData]);

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !activeRequest) return;
    const persisted = await addComment(activeRequest.id, feedbackText);
    if (persisted) {
      setFeedbackText("");
      toast.success("Your feedback has been appended to the request timeline.");
    } else {
      toast.error("Feedback could not be saved. Please try again.");
    }
  };

  // Send an approved/delivered brief back to the research team with feedback.
  const handleSendBack = async () => {
    if (!detail || !sendBackText.trim()) return;
    setSendingBack(true);
    try {
      await requestRevisionForRequest(detail.id, sendBackText);
      await addComment(detail.id, sendBackText, "Revision Request");
      toast.success(
        "Brief sent back for revision. The research team and administrators have been notified.",
      );
      setSendBackOpen(false);
      setSendBackText("");
      await refreshRequests();
      await fetchModalData(detail.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send the brief back");
    } finally {
      setSendingBack(false);
    }
  };

  // Record that the member is satisfied with the delivered research.
  const handleConfirmSatisfaction = async () => {
    if (!detail) return;
    setConfirming(true);
    try {
      await confirmMemberSatisfaction(detail.id, confirmNote.trim() || undefined);
      toast.success(
        "Thank you. Your confirmation has been recorded and the administrators have been notified.",
      );
      setConfirmOpen(false);
      setConfirmNote("");
      await refreshRequests();
      await fetchModalData(detail.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to record your confirmation");
    } finally {
      setConfirming(false);
    }
  };

  const handleExtendDeadline = async (
    requestId: string,
    currentDeadline: string,
    days: number,
  ) => {
    const newDate = extendDeadlineStr(currentDeadline, days);
    const ok = await extendRequestDeadline(requestId, newDate);
    if (ok) {
      toast.success(`Deadline extended by ${days} days to ${formatDate(newDate)}.`);
      refreshRequests();
      if (trackingModalRequest) {
        fetchModalData(trackingModalRequest.id);
      }
    } else {
      toast.error("Failed to extend the deadline. Please try again.");
    }
  };

  const getStatusLabel = (status: ResearchRequest["status"]) => {
    switch (status) {
      case "SUBMITTED":
        return "Submitted";
      case "ASSIGNED":
        return "Assigned";
      case "IN_PROGRESS":
        return "In Progress";
      case "DRAFT_SUBMITTED":
        return "Draft Submitted";
      case "REVISION_REQUESTED":
        return "Revision Requested";
      case "REVISED":
        return "Revised";
      case "APPROVED":
        return "Approved";
      case "DELIVERED":
        return "Delivered";
      case "MEMBER_CONFIRMED":
        return "Confirmed by Member";
      case "CLOSED":
        return "Closed";
      case "OVERDUE":
        return "Overdue";
      default:
        return status;
    }
  };

  const getTimelineSteps = (req: ResearchRequest) => {
    const isAssigned = [
      "ASSIGNED",
      "IN_PROGRESS",
      "DRAFT_SUBMITTED",
      "REVISION_REQUESTED",
      "REVISED",
      "APPROVED",
      "DELIVERED",
      "CLOSED",
    ].includes(req.status);
    const isInProgress = [
      "IN_PROGRESS",
      "DRAFT_SUBMITTED",
      "REVISION_REQUESTED",
      "REVISED",
      "APPROVED",
      "DELIVERED",
      "CLOSED",
    ].includes(req.status);
    const isRevision = ["REVISION_REQUESTED", "REVISED"].includes(req.status);
    const isCompleted = ["APPROVED", "DELIVERED", "MEMBER_CONFIRMED", "CLOSED"].includes(
      req.status,
    );
    const isDelivered = ["DELIVERED", "MEMBER_CONFIRMED", "CLOSED"].includes(req.status);
    // Confirming closes the brief, so the status cannot be the signal here.
    const isMemberConfirmed = !!req.memberConfirmedAt;
    const isAwaitingMember = AWAITING_MEMBER_STATUSES.includes(req.status);

    type StepStatus = "completed" | "active" | "pending";
    const steps: {
      title: string;
      date: string | null;
      desc: string;
      status: StepStatus;
    }[] = [
      {
        title: "Request Submitted",
        date: req.dateSubmitted,
        desc: "Request received and authenticated by administrative desk.",
        status: "completed",
      },
      {
        title: "Staff Appointed",
        date: isAssigned ? detail?.dateAssigned || req.dateSubmitted : null,
        desc: isAssigned
          ? "Lead researcher appointed."
          : "Selecting suitable research staff.",
        status: isAssigned ? "completed" : "pending",
      },
      {
        title: "Draft Synthesis Active",
        date: isInProgress ? req.deadline : null,
        desc: isInProgress
          ? "Core research formulated and policy implications drafted."
          : "Research synthesis not started.",
        status: isCompleted ? "completed" : isInProgress ? "active" : "pending",
      },
      {
        title: "Administrative Peer Review",
        date: isCompleted
          ? detail?.dateCompleted || req.deadline
          : isRevision
            ? "Revision Required"
            : null,
        desc: isCompleted
          ? "Final administrative check completed."
          : isRevision
            ? "Comments submitted for revision."
            : "Awaiting officer draft submission.",
        status: isCompleted ? "completed" : isRevision ? "active" : "pending",
      },
      {
        title: "Brief Delivered",
        date: isDelivered ? detail?.dateDelivered || req.deadline : null,
        desc: isDelivered
          ? "Secure brief transmitted to Member Office."
          : isAwaitingMember
            ? "Approved and released to your office for your response."
            : "Delivery upon final peer-review approval.",
        status: isDelivered ? "completed" : isAwaitingMember ? "active" : "pending",
      },
      {
        title: "Member Sign-off",
        date: isMemberConfirmed ? detail?.memberConfirmedAt || null : null,
        desc: isMemberConfirmed
          ? "You confirmed the research met your requirements."
          : isAwaitingMember
            ? "Confirm the research is satisfactory, or send it back with feedback."
            : "Recorded once you confirm the delivered research is satisfactory.",
        status: isMemberConfirmed ? "completed" : isAwaitingMember ? "active" : "pending",
      },
    ];
    return steps;
  };

  const steps = activeRequest ? getTimelineSteps(activeRequest) : [];
  const progress = activeRequest
    ? (PROGRESS_MAP[activeRequest.status] ?? 0)
    : 0;
  const deadlineInfo = activeRequest
    ? getDaysRemaining(activeRequest.deadline)
    : null;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h2 className="font-sans font-bold text-3xl text-[#191c1d]">
          Welcome back,{" "}
          {currentUser.role === "MP"
            ? honourable(currentUser.name)
            : currentUser.name}
        </h2>
        <p className="font-sans text-sm text-[#434655] mt-1.5">
          Track legislative requests and access delivered research briefs.
        </p>
      </div>

      {/* Member Portal Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Active Requests
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {
                memberRequests.filter(
                  (r) =>
                    !isClosedStatus(r.status),
                ).length
              }
            </h3>
            <p className="text-[11px] text-[#434655] mt-1">In progress</p>
          </div>
          <div className="p-3 bg-blue-50 text-[#0037b0] rounded">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Overdue
            </p>
            <h3 className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? "text-[#ba1a1a]" : "text-[#191c1d]"}`}>
              {overdueCount}
            </h3>
            <p className={`text-[11px] font-semibold mt-1 ${overdueCount > 0 ? "text-[#93000a]" : "text-emerald-800"}`}>
              {overdueCount > 0 ? "Needs attention" : "All on track"}
            </p>
          </div>
          <div className="p-3 bg-red-50 text-[#ba1a1a] rounded">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Urgent
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {urgentCount}
            </h3>
            <p className="text-[11px] text-[#93000a] font-semibold mt-1">
              High priority
            </p>
          </div>
          <div className="p-3 bg-orange-50 text-orange-700 rounded">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Completed
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {
                memberRequests.filter((r) =>
                  isClosedStatus(r.status),
                ).length
              }
            </h3>
            <p className="text-[11px] text-emerald-800 font-semibold mt-1">
              Delivered briefs
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-[#006b2c] rounded">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Total Requests
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {memberRequests.length}
            </h3>
            <p className="text-[11px] text-[#434655] mt-1">All time</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Active selected request tracking timeline split */}
      {activeRequest && (
        <section className="bg-white border border-[#c4c5d7] rounded-lg overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-3">
          {/* Left / Middle: Interactive Timeline */}
          <div className="lg:col-span-2 p-8 border-r border-[#c4c5d7] space-y-6">
            <header className="border-b border-gray-100 pb-4">
              <span className="bg-[#dce1ff] text-[#001551] font-bold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                Active Tracking: {shortId(activeRequest.id)}
              </span>
              <h3 className="text-xl font-bold text-[#191c1d] mt-2 leading-snug">
                {activeRequest.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Category:{" "}
                <span className="font-semibold text-gray-700">
                  {activeRequest.category}
                </span>{" "}
                • Topic:{" "}
                <span className="font-semibold text-gray-700">
                  {activeRequest.topic}
                </span>
              </p>
            </header>

            {/* Vertical timeline steps */}
            <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {steps.map((step, idx) => {
                let dotClass = "bg-gray-200 text-gray-400";
                let titleClass = "text-gray-400 font-medium";
                if (step.status === "completed") {
                  dotClass = "bg-[#0037b0] text-white ring-4 ring-blue-50";
                  titleClass = "text-gray-900 font-bold";
                } else if (step.status === "active") {
                  dotClass =
                    "bg-yellow-500 text-white ring-4 ring-yellow-50 animate-pulse";
                  titleClass = "text-yellow-800 font-bold";
                }

                return (
                  <div className="flex gap-6 relative z-10" key={idx}>
                    <div
                      className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold ${dotClass}`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className={`text-sm ${titleClass}`}>
                          {step.title}
                        </h4>
                        <span className="text-[11px] font-semibold text-gray-400">
                          {step.date ? formatDate(step.date as string) : "—"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-normal">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side: Sidebar files and updates */}
          <div className="p-8 bg-gray-50 flex flex-col justify-between">
            <div className="space-y-6">
              <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider">
                Delivered Attachments
              </h4>

              {activeRequest.attachments.length > 0 ? (
                <div className="space-y-3">
                  {activeRequest.attachments.map((file, fIdx) => (
                    <div
                      key={fIdx}
                      className="bg-white border border-[#c4c5d7] rounded-lg p-3 flex items-center justify-between shadow-sm hover:border-[#0037b0] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                          PDF
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 truncate max-w-37.5">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {file.size}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (file.id) {
                            downloadFile(file.id, file.name).catch(() =>
                              toast.error(`Failed to download "${file.name}"`),
                            );
                          } else {
                            toast.info("File not yet uploaded to server");
                          }
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-700 hover:text-[#0037b0] transition-colors"
                        title="Download Brief"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 text-center text-xs text-gray-500 italic">
                  No draft files have been submitted for review yet.
                </div>
              )}

              <div className="mt-4">
                <input
                  type="file"
                  id="dashboard-file-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activeRequest) {
                      uploadFile(activeRequest.id, file)
                        .then(() => {
                          toast.success(
                            `"${file.name}" uploaded successfully.`,
                          );
                          refreshRequests();
                          if (trackingModalRequest) {
                            fetchModalData(trackingModalRequest.id);
                          }
                        })
                        .catch(() => toast.error("Failed to upload file"));
                    }
                  }}
                />
                <button
                  onClick={() =>
                    document.getElementById("dashboard-file-upload")?.click()
                  }
                  className="w-full bg-white border border-dashed border-[#0037b0] text-[#0037b0] hover:bg-blue-50 text-xs font-semibold py-2 rounded flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Additional Document</span>
                </button>
              </div>

              <form
                onSubmit={handleSendFeedback}
                className="space-y-3 border-t border-gray-200 pt-6"
              >
                <h5 className="font-sans font-bold text-xs text-gray-700">
                  Add Directive / Feedback
                </h5>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Ask for focus updates or comment on research scope..."
                  className="w-full bg-white border border-[#c4c5d7] rounded p-2 text-xs h-20 outline-none focus:ring-1 focus:ring-[#0037b0]"
                />
                <button
                  type="submit"
                  className="w-full bg-[#515f74] hover:bg-[#3a485c] text-white text-xs font-semibold py-2 rounded flex items-center justify-center gap-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Memo</span>
                </button>
              </form>
            </div>

            <div className="border-t border-gray-200 pt-6 mt-6 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-gray-900">
                  Need immediate updates?
                </p>
                <p className="text-[10px] text-gray-500">
                  Submit a priority review ticket
                </p>
              </div>
              <button
                onClick={() => {
                  setIsExpedited(true);
                  if (activeRequest) {
                    updateRequestPriority(activeRequest.id, "URGENT");
                  }
                  toast.success(
                    "Urgent review status triggered. Admin has been notified.",
                  );
                }}
                disabled={isExpedited}
                className={`text-xs font-semibold px-3 py-1.5 rounded transition-all ${
                  isExpedited
                    ? "bg-amber-100 text-amber-800 cursor-default"
                    : "bg-white border border-[#0037b0] text-[#0037b0] hover:bg-blue-50"
                }`}
              >
                {isExpedited ? "Urgent Requested" : "Request Rush"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Active Requests List Table */}
      <section className="bg-white border border-[#c4c5d7] rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c5d7] bg-[#f3f4f5]">
          <h4 className="font-sans font-semibold text-[#191c1d]">
            Your Active Requests
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f4f5]/30 border-b border-[#c4c5d7]">
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                  Request ID
                </th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                  Title
                </th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                  Research Topic
                </th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                  Priority
                </th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                  Deadline
                </th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRequests.map((req) => {
                const d = getDaysRemaining(req.deadline);
                return (
                <tr
                  key={req.id}
                  className={`cursor-pointer transition-colors hover:bg-[#f3f4f5]/30 ${
                    req.id === selectedRequestId
                      ? "bg-blue-50/40 font-medium"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedRequestId(req.id);
                    setTrackingModalRequest(req);
                  }}
                >
                  <td className="px-6 py-3.5 text-xs font-bold text-[#0037b0] whitespace-nowrap">
                    {shortId(req.id)}
                  </td>
                  <td className="px-6 py-3.5 text-sm text-[#191c1d] font-semibold max-w-64">
                    <span className="block truncate" title={req.title}>
                      {req.title}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-gray-500">
                    {req.category}
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        req.priority === "URGENT"
                          ? "bg-[#ffdad6] text-[#93000a]"
                          : "bg-[#edeeef] text-gray-600"
                      }`}
                    >
                      {req.priority}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        STATUS_STYLES[req.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {getStatusLabel(req.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-0.5">
                      <span className={`text-xs font-semibold ${d.color.split(" ")[0]}`}>
                        {req.deadline}
                      </span>
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${d.color}`}>
                        {d.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!isClosedStatus(req.status) && (
                        <div
                          className="relative"
                          ref={extendMenuOpenId === req.id ? extendMenuRef : undefined}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExtendMenuOpenId((prev) =>
                                prev === req.id ? null : req.id,
                              );
                            }}
                            aria-expanded={extendMenuOpenId === req.id}
                            aria-haspopup="menu"
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              req.status === "OVERDUE"
                                ? "text-[#ba1a1a] hover:bg-red-50"
                                : "text-[#0037b0] hover:bg-blue-50"
                            }`}
                            title="Extend Deadline"
                            aria-label="Extend Deadline"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                          <div
                            className={`absolute right-0 top-full mt-1 w-36 bg-white border border-[#c4c5d7] rounded-md shadow-lg z-50 py-1 ${
                              extendMenuOpenId === req.id ? "block" : "hidden"
                            }`}
                            role="menu"
                          >
                            <div className="px-2.5 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                              Extend Due Date
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExtendMenuOpenId(null);
                                handleExtendDeadline(req.id, req.deadline, 7);
                              }}
                              role="menuitem"
                              className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              +7 Days
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExtendMenuOpenId(null);
                                handleExtendDeadline(req.id, req.deadline, 14);
                              }}
                              role="menuitem"
                              className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              +14 Days
                            </button>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequestId(req.id);
                          setTrackingModalRequest(req);
                        }}
                        className="text-[#0037b0] hover:underline text-xs font-bold flex items-center justify-end gap-1"
                      >
                        <span>Track</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPageClamped}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={memberRequests.length}
          onPageChange={setCurrentPage}
          label="requests"
        />
      </section>

      {/* ═══════════════════════════════════════════════════════
          ENHANCED TRACKING MODAL
          ═══════════════════════════════════════════════════════ */}
      {trackingModalRequest && (
        <div
          ref={trackingDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-tracking-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setTrackingModalRequest(null)}
        >
          <div
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Modal Header ── */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-[#dce1ff] text-[#001551] font-bold text-xs px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {shortId(trackingModalRequest.id)}
                </span>
                <div>
                  <h3 id="member-tracking-title" className="font-sans font-bold text-gray-900 text-sm">
                    {trackingModalRequest.title}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                    {trackingModalRequest.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTrackingModalRequest(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Modal Body ── */}
            <div className="flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0037b0]" />
                </div>
              ) : detail ? (
                <div className="p-6 space-y-6">
                  {/* ── Status + Priority + Time Remaining ── */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        ["APPROVED", "DELIVERED", "CLOSED"].includes(
                          detail.status,
                        )
                          ? "bg-emerald-100 text-emerald-800"
                          : detail.status === "OVERDUE"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {getStatusLabel(detail.status)}
                    </span>
                    {detail.priority === "URGENT" && (
                      <span className="bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-200 animate-pulse uppercase tracking-wider">
                        Urgent Priority
                      </span>
                    )}
                    {deadlineInfo && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${deadlineInfo.color}`}
                      >
                        {deadlineInfo.label}
                      </span>
                    )}
                  </div>

                  {/* ── Progress Bar ── */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-[#434655]">
                      <span className="uppercase tracking-wider">
                        Workflow Progress
                      </span>
                      <span className="text-[#0037b0]">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0037b0] rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* ── Member sign-off banner ── */}
                  {detail.status === "MEMBER_CONFIRMED" && (
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-emerald-800">
                          You confirmed this brief
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          Confirmed on {formatDate(detail.memberConfirmedAt)}. The administrators have been notified and will close the request.
                        </p>
                        {detail.memberConfirmationNote && (
                          <p className="text-[11px] text-emerald-800 mt-1 italic">
                            Your remarks: &ldquo;{detail.memberConfirmationNote}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {AWAITING_MEMBER_STATUSES.includes(detail.status) && (
                    <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-teal-900">
                            {detail.status === "DELIVERED"
                              ? "Research brief delivered"
                              : "Research brief approved"}
                          </p>
                          <p className="text-[11px] text-teal-800 mt-0.5">
                            Are you satisfied with this research? Confirm it so the
                            administrators can close the request, or send it back with
                            your feedback and the research team will revise it.
                          </p>
                        </div>
                      </div>
                      {sendBackOpen ? (
                        <div className="space-y-2">
                          <label
                            htmlFor="member-send-back"
                            className="block text-xs font-bold text-teal-900"
                          >
                            What needs to change?
                          </label>
                          <textarea
                            id="member-send-back"
                            value={sendBackText}
                            onChange={(e) => setSendBackText(e.target.value)}
                            rows={3}
                            placeholder="e.g., Please expand the fiscal impact section and include 2025 figures..."
                            className="w-full border border-[#c4c5d7] rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-[#0037b0] bg-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setSendBackOpen(false);
                                setSendBackText("");
                              }}
                              className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSendBack}
                              disabled={sendingBack || !sendBackText.trim()}
                              className="px-3 py-1.5 text-xs font-semibold bg-[#b45309] text-white rounded hover:bg-[#92400e] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              {sendingBack ? "Sending..." : "Send Back for Revision"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => setSendBackOpen(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-[#b45309] text-[#b45309] text-xs font-bold rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Send Back with Feedback
                          </button>
                          <button
                            onClick={() => setConfirmOpen(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#006b2c] text-white text-xs font-bold rounded-lg hover:bg-[#005a25] transition-colors cursor-pointer"
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                            I&rsquo;m Satisfied
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Assignment confirmation (team/officer identity withheld) ── */}
                  {(detail.officer || detail.assignments.length > 0) && (
                    <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 rounded-lg p-3">
                      <div className="w-9 h-9 rounded-full bg-[#006b2c] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                          Research Team Assignment
                        </p>
                        <p className="text-xs font-semibold text-[#00501f]">
                          A research team has been appointed and is preparing your brief.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── Milestone Timestamps ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Submitted", date: detail.dateSubmitted },
                      { label: "Assigned", date: detail.dateAssigned },
                      { label: "Completed", date: detail.dateCompleted },
                      { label: "Confirmed", date: detail.memberConfirmedAt },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className={`rounded-lg p-2.5 text-center border ${
                          m.date
                            ? "bg-blue-50/50 border-blue-100"
                            : "bg-gray-50 border-gray-100"
                        }`}
                      >
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                          {m.label}
                        </p>
                        <p
                          className={`text-xs font-bold mt-0.5 ${m.date ? "text-gray-900" : "text-gray-400"}`}
                        >
                          {m.date ? formatDate(m.date) : "—"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* ── Vertical Timeline Steps ── */}
                  <div>
                    <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase tracking-wider mb-4">
                      Progress Timeline
                    </h4>
                    <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                      {getTimelineSteps(trackingModalRequest).map(
                        (step, idx) => {
                          let dotClass = "bg-gray-200 text-gray-400";
                          let titleClass = "text-gray-400 font-medium";
                          if (step.status === "completed") {
                            dotClass =
                              "bg-[#0037b0] text-white ring-4 ring-blue-50";
                            titleClass = "text-gray-900 font-bold";
                          } else if (step.status === "active") {
                            dotClass =
                              "bg-yellow-500 text-white ring-4 ring-yellow-50 animate-pulse";
                            titleClass = "text-yellow-800 font-bold";
                          }

                          return (
                            <div className="flex gap-5 relative z-10" key={idx}>
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${dotClass}`}
                              >
                                {step.status === "completed" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  idx + 1
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <h4 className={`text-sm ${titleClass}`}>
                                    {step.title}
                                  </h4>
                                  <span className="text-[11px] font-semibold text-gray-400 shrink-0">
                                    {step.date
                                      ? formatDate(step.date as string)
                                      : "—"}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 leading-normal">
                                  {step.desc}
                                </p>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {/* ── Draft Version History ── */}
                  {detail.reports.length > 0 && (
                    <div className="border-t border-gray-100 pt-5 space-y-3">
                      <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5" />
                        Draft Version History
                      </h4>
                      {detail.reports.map((report) => (
                        <div
                          key={report.id}
                          className="bg-gray-50 border border-[#c4c5d7] rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="bg-[#dce1ff] text-[#001551] text-[10px] font-bold px-2 py-0.5 rounded">
                                v{report.version}
                              </span>
                              <span className="text-xs font-bold text-gray-900">
                                {report.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {report.isApproved && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  Approved
                                </span>
                              )}
                              {report.isDraft && !report.isApproved && (
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  Draft
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500">
                            by {report.author.firstName}{" "}
                            {report.author.lastName} •{" "}
                            {formatDate(report.createdAt)}
                          </p>
                          {report.versions.length > 1 && (
                            <div className="flex flex-wrap gap-1">
                              {report.versions.map((v) => (
                                <span
                                  key={v.id}
                                  className="text-[10px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded"
                                >
                                  v{v.version}
                                  {v.notes ? ` — ${v.notes}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Activity Feed ── */}
                  {activityLogs.length > 0 && (
                    <div className="border-t border-gray-100 pt-5 space-y-3">
                      <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Activity Feed
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {activityLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                          >
                            <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {log.author?.initials || "—"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-900">
                                <span className="font-bold">
                                  {log.author?.firstName} {log.author?.lastName}
                                </span>{" "}
                                <span className="text-gray-500">
                                  {log.description.toLowerCase()}
                                </span>
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">
                                  {formatRelativeTime(log.createdAt)}
                                </span>
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                                  {ACTION_LABELS[log.action] || log.action}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Comments Thread ── */}
                  {detail.comments.length > 0 && (
                    <div className="border-t border-gray-100 pt-5 space-y-3">
                      <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Comments &amp; Feedback ({detail.comments.length})
                      </h4>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {detail.comments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`rounded-lg p-3 border ${
                              comment.resolved
                                ? "bg-gray-50 border-gray-100 opacity-60"
                                : "bg-white border-[#c4c5d7]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#515f74] text-white flex items-center justify-center text-[9px] font-bold">
                                  {comment.author.initials}
                                </div>
                                <span className="text-xs font-bold text-gray-900">
                                  {comment.author.title
                                    ? `${comment.author.title} `
                                    : ""}
                                  {comment.author.firstName}{" "}
                                  {comment.author.lastName}
                                </span>
                                {comment.section && (
                                  <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                    {comment.section}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {comment.resolved && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                    Resolved
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400">
                                  {formatRelativeTime(comment.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                              {comment.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Delivered Attachments ── */}
                  {detail.attachments.length > 0 && (
                    <div className="border-t border-gray-100 pt-5 space-y-3">
                      <h4 className="font-sans font-bold text-xs text-[#191c1d] uppercase tracking-wider">
                        Delivered Attachments
                      </h4>
                      {detail.attachments.map((file) => (
                        <div
                          key={file.id}
                          className="bg-white border border-[#c4c5d7] rounded-lg p-3 flex items-center justify-between shadow-sm hover:border-[#0037b0] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                              {file.fileType}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900 truncate max-w-75">
                                {file.name}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {file.fileSize
                                  ? `${(file.fileSize / 1024).toFixed(1)} KB`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              downloadFile(file.id, file.name).catch(() =>
                                toast.error(
                                  `Failed to download "${file.name}"`,
                                ),
                              );
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-700 hover:text-[#0037b0] transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-20 text-sm text-gray-500">
                  No details available.
                </div>
              )}
            </div>

            {/* ── Modal Footer ── */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-end items-center gap-2 shrink-0">
              {detail && !isClosedStatus(detail.status) && (
                <div
                  className="relative"
                  ref={extendMenuOpenId === detail.id ? extendMenuRef : undefined}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExtendMenuOpenId((prev) =>
                        prev === detail.id ? null : detail.id,
                      );
                    }}
                    aria-expanded={extendMenuOpenId === detail.id}
                    aria-haspopup="menu"
                    className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded border transition-colors cursor-pointer ${
                      detail.status === "OVERDUE"
                        ? "border-[#ba1a1a] text-[#ba1a1a] hover:bg-red-50"
                        : "border-[#0037b0] text-[#0037b0] hover:bg-blue-50"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Extend Deadline
                  </button>
                  <div
                    className={`absolute right-0 bottom-full mb-1 w-36 bg-white border border-[#c4c5d7] rounded-md shadow-lg z-50 py-1 ${
                      extendMenuOpenId === detail.id ? "block" : "hidden"
                    }`}
                    role="menu"
                  >
                    <div className="px-2.5 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      Extend Due Date
                    </div>
                    <button
                      onClick={() => {
                        setExtendMenuOpenId(null);
                        handleExtendDeadline(detail.id, detail.deadline, 7);
                      }}
                      role="menuitem"
                      className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      +7 Days
                    </button>
                    <button
                      onClick={() => {
                        setExtendMenuOpenId(null);
                        handleExtendDeadline(detail.id, detail.deadline, 14);
                      }}
                      role="menuitem"
                      className="w-full text-left px-3 py-1.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      +14 Days
                    </button>
                  </div>
                </div>
              )}
              <button
                onClick={() => setTrackingModalRequest(null)}
                className="text-xs font-semibold px-4 py-2 rounded bg-white border border-[#c4c5d7] text-[#191c1d] hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MEMBER SATISFACTION CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════ */}
      {confirmOpen && detail && (
        <div
          ref={confirmDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-satisfaction-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex items-center gap-3">
              <BadgeCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3
                  id="member-satisfaction-title"
                  className="font-sans font-bold text-gray-900 text-sm"
                >
                  Confirm You Are Satisfied
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {detail.title}
                </p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                This records that the research answers your question. The date and
                time will be logged, the administrators will be notified, and the
                request will move to <strong>Confirmed by Member</strong> so they can
                close it out.
              </p>
              <label
                htmlFor="member-satisfaction-note"
                className="block text-xs font-bold text-gray-700"
              >
                Remarks{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="member-satisfaction-note"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                rows={3}
                placeholder="e.g., This covers the western region breakdown we needed. Thank you."
                className="w-full border border-[#c4c5d7] rounded p-3 text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
              />
            </div>
            <div className="px-6 py-4 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSatisfaction}
                disabled={confirming}
                className="px-4 py-2 text-xs font-semibold bg-[#006b2c] text-white rounded hover:bg-[#005a25] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <BadgeCheck className="w-3.5 h-3.5" />
                {confirming ? "Recording..." : "Yes, I'm Satisfied"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
