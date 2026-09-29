import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getOfficers } from "../lib/api";
import { honourable } from "../lib/format";
import { formatRequestStatus } from "../lib/status";
import { ResearchRequest } from "../types";
import { AssignModal } from "./AssignModal";
import { useDialogA11y } from "../lib/useDialogA11y";
import { ExportButton } from "./ExportButton";
import { Pagination } from "./Pagination";
import { ConfirmDialog } from "./ConfirmDialog";
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
  Activity,
  CheckCircle,
  MoreHorizontal,
  Flag,
  X,
  XCircle,
  History,
  Search,
  Undo2,
  Send,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface AdminDashboardViewProps {
  onNavigate: (view: string, targetId?: string) => void;
}

interface StageMeta {
  label: string;
  color: string;
  values: string[] | null;
}

const STAGE_META: Record<string, StageMeta> = {
  pending: { label: 'Pending', color: 'bg-[#0037b0]', values: ['SUBMITTED', 'ASSIGNED'] },
  assigned: { label: 'Assigned', color: 'bg-blue-600', values: null },
  inProgress: { label: 'In Progress', color: 'bg-amber-500', values: ['IN_PROGRESS', 'REVISED'] },
  awaitingReview: { label: 'Awaiting Review', color: 'bg-purple-500', values: ['DRAFT_SUBMITTED', 'REVISION_REQUESTED', 'REVISED'] },
  approved: { label: 'Approved', color: 'bg-green-600', values: ['APPROVED'] },
  delivered: { label: 'Delivered', color: 'bg-emerald-600', values: ['DELIVERED'] },
  overdue: { label: 'Overdue', color: 'bg-[#ba1a1a]', values: ['OVERDUE'] },
  closed: { label: 'Closed', color: 'bg-gray-400', values: ['CLOSED'] },
};

const PIPELINE_ORDER = ['pending', 'inProgress', 'awaitingReview', 'approved', 'delivered', 'overdue', 'closed'];

const BAR_VALUES: Record<string, string[]> = {
  pending: ['SUBMITTED', 'ASSIGNED'],
  inProgress: ['IN_PROGRESS'],
  awaitingReview: ['DRAFT_SUBMITTED', 'REVISION_REQUESTED', 'REVISED'],
  approved: ['APPROVED'],
  delivered: ['DELIVERED'],
  overdue: ['OVERDUE'],
  closed: ['CLOSED'],
};

const CONFIRM_META: Record<
  'REVISION_REQUESTED' | 'APPROVED' | 'DELIVERED' | 'CLOSED',
  { title: string; label: string; tone: 'danger' | 'neutral'; message: string }
> = {
  REVISION_REQUESTED: {
    title: 'Request Revision',
    label: 'Request Revision',
    tone: 'danger',
    message:
      'Send this brief back to the research officer for changes? It will be reopened for editing.',
  },
  APPROVED: {
    title: 'Approve Brief',
    label: 'Approve',
    tone: 'neutral',
    message:
      'Approve this brief? It will become final and move to the delivered stage.',
  },
  DELIVERED: {
    title: 'Mark as Delivered',
    label: 'Mark Delivered',
    tone: 'neutral',
    message:
      'Mark this brief as delivered to the member?',
  },
  CLOSED: {
    title: 'Close Request',
    label: 'Close Request',
    tone: 'danger',
    message:
      'Close this request for good? It will be moved to the archive.',
  },
};

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  onNavigate,
}) => {
  const { requests, history, updateRequestStatus, updateRequestPriority } =
    useApp();
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING">("ALL");
  const [showHighPriorityOnly, setShowHighPriorityOnly] =
    useState<boolean>(false);
  const [assignModalRequestId, setAssignModalRequestId] = useState<
    string | null
  >(null);
  const [assignModalRequestTitle, setAssignModalRequestTitle] =
    useState<string>("");
  const [activeRequest, setActiveRequest] = useState<ResearchRequest | null>(
    null,
  );
  const [officers, setOfficers] = useState<any[]>([]);
  const [officersError, setOfficersError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [activityPage, setActivityPage] = useState(1);
  const activityPageSize = 5;
  const [officerPage, setOfficerPage] = useState(1);
  const officerPageSize = 5;
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    req: ResearchRequest;
    action: "REVISION_REQUESTED" | "APPROVED" | "DELIVERED" | "CLOSED";
  } | null>(null);

  const loadOfficers = useCallback(() => {
    setOfficersError(false);
    getOfficers()
      .then((data) => {
        if (Array.isArray(data)) setOfficers(data);
      })
      .catch(() => setOfficersError(true));
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpenId]);

  useEffect(() => {
    loadOfficers();
  }, [loadOfficers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, showHighPriorityOnly, stageFilter, categoryFilter, tableSearch]);

  useEffect(() => {
    setActivityPage(1);
  }, [history.length]);

  useEffect(() => {
    setOfficerPage(1);
  }, [officers.length]);

  const activeRequestDialogRef = useDialogA11y<HTMLDivElement>({
    onClose: () => setActiveRequest(null),
    enabled: !!activeRequest,
  });

  // Derive counts from requests state
  const totalPending = requests.filter(
    (r) => r.status === "SUBMITTED" || r.status === "ASSIGNED",
  ).length;
  const totalAssigned = requests.filter(
    (r) => r.assignedOfficerId !== null,
  ).length;
  const inProgressCount = requests.filter(
    (r) => r.status === "IN_PROGRESS" || r.status === "REVISED",
  ).length;
  const overdueCount = requests.filter((r) => r.status === "OVERDUE").length;

  // Pipeline stage counts (each status maps to exactly one stage)
  const pipelineCounts: Record<string, number> = {};
  PIPELINE_ORDER.forEach((k) => { pipelineCounts[k] = 0; });
  requests.forEach((r) => {
    for (const k of PIPELINE_ORDER) {
      const vals = BAR_VALUES[k];
      if (vals.includes(r.status)) {
        pipelineCounts[k] = (pipelineCounts[k] || 0) + 1;
        break;
      }
    }
  });

  // Category distribution
  const categoryCounts: [string, number][] = (() => {
    const map = new Map<string, number>();
    requests.forEach((r) => {
      const key = r.category?.trim() || "Uncategorised";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();

  const matchesStage = (req: ResearchRequest) => {
    if (!stageFilter) return true;
    if (stageFilter === "assigned") return req.assignedOfficerId !== null;
    const meta = STAGE_META[stageFilter];
    if (!meta?.values) return true;
    return meta.values.includes(req.status);
  };

  const toggleStage = (key: string) => {
    setStageFilter((prev) => (prev === key ? null : key));
    setCurrentPage(1);
  };

  const toggleCategory = (cat: string) => {
    setCategoryFilter((prev) => (prev === cat ? null : cat));
    setCurrentPage(1);
  };

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
    if (diffDays <= 3) return { kind: "soon" as const, days: diffDays };
    return { kind: "ok" as const };
  };

  const nextActionHint = (status: ResearchRequest["status"]): string => {
    const map: Record<string, string> = {
      SUBMITTED: "Assign",
      ASSIGNED: "Track",
      IN_PROGRESS: "Track",
      DRAFT_SUBMITTED: "Review",
      REVISION_REQUESTED: "Review",
      REVISED: "Review",
      APPROVED: "Deliver",
      DELIVERED: "Close",
      OVERDUE: "Act now",
      CLOSED: "",
      REPEAT_REQUESTED: "",
    };
    return map[status] || "";
  };

  const primaryAction = (req: ResearchRequest): { label: string; tone: string } | null => {
    if (req.status === "SUBMITTED" && !req.assignedOfficerId && !req.teamId) {
      return { label: "Assign", tone: "bg-[#0037b0] hover:bg-[#1d4ed8]" };
    }
    const map: Record<string, { label: string; tone: string }> = {
      DRAFT_SUBMITTED: { label: "Approve", tone: "bg-[#006b2c] hover:bg-[#00501f]" },
      REVISION_REQUESTED: { label: "Approve", tone: "bg-[#006b2c] hover:bg-[#00501f]" },
      REVISED: { label: "Approve", tone: "bg-[#006b2c] hover:bg-[#00501f]" },
      APPROVED: { label: "Deliver", tone: "bg-[#0037b0] hover:bg-[#1d4ed8]" },
      DELIVERED: { label: "Close", tone: "bg-gray-700 hover:bg-gray-800" },
      OVERDUE: { label: "Review", tone: "bg-[#ba1a1a] hover:bg-[#93000a]" },
    };
    return map[req.status] || null;
  };

  const runPrimaryAction = (req: ResearchRequest) => {
    if (req.status === "SUBMITTED" && !req.assignedOfficerId && !req.teamId) {
      setAssignModalRequestId(req.id);
      setAssignModalRequestTitle(req.title);
      return;
    }
    if (["DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"].includes(req.status)) {
      setConfirmAction({ req, action: "APPROVED" });
    } else if (req.status === "APPROVED") {
      setConfirmAction({ req, action: "DELIVERED" });
    } else if (req.status === "DELIVERED") {
      setConfirmAction({ req, action: "CLOSED" });
    } else if (req.status === "OVERDUE") {
      onNavigate("briefs", req.id);
    }
  };

  // Filter requests for display
  const filteredRequests = requests.filter((req) => {
    if (showHighPriorityOnly && req.priority !== "URGENT") return false;
    if (
      filterTab === "PENDING" &&
      !["SUBMITTED", "ASSIGNED"].includes(req.status)
    )
      return false;
    if (!matchesStage(req)) return false;
    if (categoryFilter && req.category !== categoryFilter) return false;
    const q = tableSearch.trim().toLowerCase();
    if (
      q &&
      !(
        req.id.toLowerCase().includes(q) ||
        req.title.toLowerCase().includes(q) ||
        req.member.toLowerCase().includes(q) ||
        (req.assignedOfficerName || "").toLowerCase().includes(q) ||
        (req.teamName || "").toLowerCase().includes(q) ||
        (req.category || "").toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const currentPageClamped = Math.min(currentPage, totalPages);
  const paginatedRequests = filteredRequests.slice(
    (currentPageClamped - 1) * pageSize,
    currentPageClamped * pageSize,
  );

  const activityTotalPages = Math.max(
    1,
    Math.ceil(history.length / activityPageSize),
  );
  const activityPageClamped = Math.min(activityPage, activityTotalPages);
  const paginatedActivity = history.slice(
    (activityPageClamped - 1) * activityPageSize,
    activityPageClamped * activityPageSize,
  );

  const officerTotalPages = Math.max(
    1,
    Math.ceil(officers.length / officerPageSize),
  );
  const officerPageClamped = Math.min(officerPage, officerTotalPages);
  const paginatedOfficers = officers.slice(
    (officerPageClamped - 1) * officerPageSize,
    officerPageClamped * officerPageSize,
  );

  const getStatusBadge = (status: ResearchRequest["status"]) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Submitted
          </span>
        );
      case "ASSIGNED":
        return (
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Assigned
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            In Progress
          </span>
        );
      case "DRAFT_SUBMITTED":
        return (
          <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Draft Submitted
          </span>
        );
      case "REVISION_REQUESTED":
        return (
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Revision Requested
          </span>
        );
      case "REVISED":
        return (
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Revised
          </span>
        );
      case "OVERDUE":
        return (
          <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Overdue
          </span>
        );
      case "APPROVED":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Approved
          </span>
        );
      case "DELIVERED":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Delivered
          </span>
        );
      case "MEMBER_CONFIRMED":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Confirmed by Member
          </span>
        );
      case "CLOSED":
        return (
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Closed
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            {formatRequestStatus(status)}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">
            Administrative Overview
          </h2>
          <p className="font-sans text-sm text-[#434655] mt-1.5">
            Real-time monitoring of legislative research workflow.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate("projects")}
            className="bg-white border border-[#c4c5d7] px-4 py-2 rounded font-sans text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
          >
            <Filter className="w-4 h-4 text-[#747686]" />
            <span>Filter View</span>
          </button>
          <ExportButton
            data={requests.map((req) => ({
              id: req.id,
              title: req.title,
              member: honourable(req.member),
              officer: req.assignedOfficerName || "Unassigned",
              status: req.status,
              deadline: req.deadline,
            }))}
            columns={[
              { key: "id", label: "Request ID" },
              { key: "title", label: "Title" },
              { key: "member", label: "Member" },
              { key: "officer", label: "Assigned Officer" },
              { key: "status", label: "Status" },
              { key: "deadline", label: "Deadline" },
            ]}
            filename="Research_Report"
            title="Administrative Research Report"
          />
        </div>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending */}
        <button
          onClick={() => toggleStage("pending")}
          className={`text-left bg-white border rounded-lg p-6 transition-all hover:border-blue-500/40 shadow-sm cursor-pointer ${
            stageFilter === "pending" ? "border-[#0037b0] ring-2 ring-blue-100" : stageFilter ? "border-[#c4c5d7] opacity-60" : "border-[#c4c5d7]"
          }`}
          title="Click to view pending requests"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#d5e3fd] rounded text-[#001551]">
              <FileText className="w-5 h-5" />
            </div>
            {stageFilter === "pending" && (
              <span className="text-[9px] font-bold text-[#0037b0] bg-[#dce1ff] px-2 py-0.5 rounded-full uppercase">Viewing</span>
            )}
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
            Total Pending
          </p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">
            {totalPending}
          </h3>
          <p className="text-xs text-gray-500 mt-2 italic">
            Awaiting review or assignment
          </p>
        </button>

        {/* Assigned */}
        <button
          onClick={() => toggleStage("assigned")}
          className={`text-left bg-white border rounded-lg p-6 transition-all hover:border-blue-500/40 shadow-sm cursor-pointer ${
            stageFilter === "assigned" ? "border-[#0037b0] ring-2 ring-blue-100" : stageFilter ? "border-[#c4c5d7] opacity-60" : "border-[#c4c5d7]"
          }`}
          title="Click to view assigned requests"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#dce1ff] rounded text-[#0039b5]">
              <UserPlus className="w-5 h-5" />
            </div>
            {stageFilter === "assigned" && (
              <span className="text-[9px] font-bold text-[#0037b0] bg-[#dce1ff] px-2 py-0.5 rounded-full uppercase">Viewing</span>
            )}
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
            Assigned
          </p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">
            {totalAssigned}
          </h3>
          <p className="text-xs text-gray-500 mt-2 italic">
            Active research requests
          </p>
        </button>

        {/* In Progress */}
        <button
          onClick={() => toggleStage("inProgress")}
          className={`text-left bg-white border rounded-lg p-6 transition-all hover:border-blue-500/40 shadow-sm relative overflow-hidden cursor-pointer ${
            stageFilter === "inProgress" ? "border-[#0037b0] ring-2 ring-blue-100" : stageFilter ? "border-[#c4c5d7] opacity-60" : "border-[#c4c5d7]"
          }`}
          title="Click to view in-progress requests"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#7ffc97]/20 rounded text-[#00501f]">
              <RefreshCw className="w-5 h-5" />
            </div>
            {stageFilter === "inProgress" && (
              <span className="text-[9px] font-bold text-[#0037b0] bg-[#dce1ff] px-2 py-0.5 rounded-full uppercase">Viewing</span>
            )}
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
            In Progress
          </p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">
            {inProgressCount}
          </h3>
          <div className="w-full bg-[#edeeef] mt-3 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#006b2c] h-full"
              style={{
                width: `${totalAssigned > 0 ? Math.round((inProgressCount / totalAssigned) * 100) : 0}%`,
              }}
            ></div>
          </div>
        </button>

        {/* Overdue */}
        <button
          onClick={() => toggleStage("overdue")}
          className={`text-left bg-white border rounded-lg p-6 transition-all hover:border-blue-500/40 shadow-sm cursor-pointer ${
            stageFilter === "overdue" ? "border-[#ba1a1a] ring-2 ring-red-100" : stageFilter ? "border-[#ba1a1a]/30 opacity-60" : "border-[#ba1a1a]/30"
          }`}
          title="Click to view overdue requests"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#ffdad6] rounded text-[#93000a]">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[#ba1a1a] font-bold text-xs flex items-center bg-[#ffdad6] px-2 py-0.5 rounded gap-0.5">
              Critical <AlertTriangle className="w-3 h-3" />
            </span>
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
            Overdue
          </p>
          <h3 className="text-3xl font-bold text-[#ba1a1a] mt-1">
            {overdueCount < 10 ? `0${overdueCount}` : overdueCount}
          </h3>
          <p className="text-xs text-[#ba1a1a] mt-2 font-medium">
            Requires immediate action
          </p>
        </button>
      </div>

      {/* Pipeline Health & Category Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline Health */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-sans font-bold text-[#191c1d] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0037b0]" />
              Pipeline Health
            </h4>
            <span className="text-xs font-bold text-gray-400 uppercase">
              {requests.length} request{requests.length === 1 ? "" : "s"}
            </span>
          </div>

          {requests.length > 0 ? (
            <>
              <div className="flex h-3 w-full rounded-full overflow-hidden bg-[#edeeef]">
                {PIPELINE_ORDER.map((key) => {
                  const count = pipelineCounts[key] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleStage(key)}
                      className={`${STAGE_META[key].color} h-full transition-all hover:brightness-110`}
                      style={{ width: `${(count / requests.length) * 100}%` }}
                      title={`${STAGE_META[key].label}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {PIPELINE_ORDER.map((key) => {
                  const meta = STAGE_META[key];
                  const count = pipelineCounts[key] || 0;
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-[10px] font-semibold text-[#747686]">
                      <span className={`w-2 h-2 rounded-full ${meta.color} ${count === 0 ? "opacity-30" : ""}`} />
                      {meta.label}
                      <span className="text-[10px] font-bold text-gray-400">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PIPELINE_ORDER.map((key) => {
                  const meta = STAGE_META[key];
                  const count = pipelineCounts[key] || 0;
                  const active = stageFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleStage(key)}
                      disabled={count === 0}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                        active
                          ? "border-[#0037b0] bg-blue-50 text-[#0037b0]"
                          : count === 0
                            ? "border-[#e0e1e6] text-gray-300 cursor-default"
                            : "border-[#e0e1e6] text-[#434655] hover:border-[#0037b0]/40 hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.color} ${count === 0 ? "opacity-30" : ""}`} />
                      <span className="truncate">{meta.label}</span>
                      <span className={`ml-auto font-bold ${active ? "text-[#0037b0]" : "text-gray-400"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp className="w-7 h-7 text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No requests yet</p>
              <p className="text-xs text-gray-400 mt-0.5">
                New requests will appear here once filed by members.
              </p>
            </div>
          )}
        </div>

        {/* Research Categories */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
          <h4 className="font-sans font-bold text-[#191c1d] flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#0037b0]" />
            Research Categories
          </h4>
          <div className="space-y-3">
            {categoryCounts.slice(0, 6).map(([cat, count]) => {
              const max = categoryCounts[0]?.[1] || 1;
              const pct = Math.round((count / max) * 100);
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`block w-full text-left group ${active ? "" : "cursor-pointer"}`}
                >
                  <div className="flex justify-between items-center text-xs mb-1 gap-2">
                    <span className={`font-semibold truncate ${active ? "text-[#0037b0]" : "text-[#434655] group-hover:text-[#0037b0]"}`}>
                      {cat}
                    </span>
                    <span className={`font-bold shrink-0 ${active ? "text-[#0037b0]" : "text-gray-400"}`}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-[#edeeef] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${active ? "bg-[#0037b0]" : "bg-blue-300 group-hover:bg-[#0037b0]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
            {categoryCounts.length > 6 && (
              <p className="text-xs text-gray-400 italic">…and {categoryCounts.length - 6} more.</p>
            )}
            {categoryCounts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="w-7 h-7 text-gray-300 mb-2" />
                <p className="text-sm font-semibold text-gray-500">No categories yet</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Categories will populate from approved research requests.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Management Table */}
      <section className="bg-white border border-[#c4c5d7] rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c5d7] flex flex-col md:flex-row justify-between items-start md:items-center bg-[#f3f4f5] gap-4">
          <h4 className="font-sans font-semibold text-[#191c1d]">
            Recent Research Requests
          </h4>
          <div className="flex items-center gap-4 flex-wrap w-full md:w-auto md:justify-end">
            {/* Local Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search requests..."
                className="w-56 bg-white border border-[#c4c5d7] rounded pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#0037b0] transition-colors shadow-sm"
              />
              {tableSearch && (
                <button
                  type="button"
                  onClick={() => setTableSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
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
                  showHighPriorityOnly ? "bg-[#0037b0]" : "bg-gray-200"
                }`}
                title="Toggle High Priority Filter"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showHighPriorityOnly ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex rounded overflow-hidden border border-[#c4c5d7] bg-white shadow-sm">
              <button
                onClick={() => setFilterTab("ALL")}
                className={`px-4 py-1.5 text-xs font-bold transition-all ${
                  filterTab === "ALL"
                    ? "bg-[#0037b0] text-white"
                    : "text-[#434655] hover:bg-gray-50"
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setFilterTab("PENDING")}
                className={`px-4 py-1.5 text-xs font-bold border-l border-[#c4c5d7] transition-all ${
                  filterTab === "PENDING"
                    ? "bg-[#0037b0] text-white"
                    : "text-[#434655] hover:bg-gray-50"
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {(stageFilter || categoryFilter || tableSearch) && (
          <div className="px-6 pt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Viewing:
            </span>
            {tableSearch && (
              <button
                onClick={() => setTableSearch("")}
                className="inline-flex items-center gap-1.5 bg-gray-100 text-[#434655] text-xs font-bold px-2.5 py-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                title="Clear search"
              >
                <Search className="w-3 h-3" />
                "{tableSearch}"
                <X className="w-3 h-3" />
              </button>
            )}
            {stageFilter && STAGE_META[stageFilter] && (
              <button
                onClick={() => toggleStage(stageFilter)}
                className="inline-flex items-center gap-1.5 bg-[#dce1ff] text-[#0037b0] text-xs font-bold px-2.5 py-1 rounded-full hover:bg-[#cedaff] transition-colors cursor-pointer"
                title="Clear filter"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STAGE_META[stageFilter].color}`} />
                {STAGE_META[stageFilter].label}
                <X className="w-3 h-3" />
              </button>
            )}
            {categoryFilter && (
              <button
                onClick={() => toggleCategory(categoryFilter)}
                className="inline-flex items-center gap-1.5 bg-[#dce1ff] text-[#0037b0] text-xs font-bold px-2.5 py-1 rounded-full hover:bg-[#cedaff] transition-colors cursor-pointer"
                title="Clear filter"
              >
                {categoryFilter}
                <X className="w-3 h-3" />
              </button>
            )}
            {(showHighPriorityOnly || filterTab === "PENDING") && (
              <span className="inline-flex items-center gap-1.5 bg-gray-100 text-[#434655] text-xs font-bold px-2.5 py-1 rounded-full">
                {showHighPriorityOnly && <span className="flex items-center gap-1"><Flag className="w-3 h-3 text-red-600 fill-red-600" /> High priority</span>}
                {showHighPriorityOnly && filterTab === "PENDING" && <span className="text-gray-300">•</span>}
                {filterTab === "PENDING" && <span>Pending</span>}
              </span>
            )}
            <button
              onClick={() => {
                setStageFilter(null);
                setCategoryFilter(null);
                setTableSearch("");
                setShowHighPriorityOnly(false);
                setFilterTab("ALL");
              }}
              className="text-xs font-semibold text-[#0037b0] hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f4f5]/50 border-b border-[#c4c5d7]">
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">
                  Request ID
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">
                  MP / RA
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">
                  Assigned Officer
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRequests.map((req) => (
                <tr
                  key={req.id}
                  className="hover:bg-[#f3f4f5]/40 transition-colors group cursor-pointer"
                  onClick={() => onNavigate("briefs", req.id)}
                >
                  {/* ID & Priority Flag */}
                  <td
                    className="px-6 py-4 font-bold text-sm text-[#191c1d]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateRequestPriority(
                            req.id,
                            req.priority === "URGENT" ? "STANDARD" : "URGENT",
                          )
                        }
                        className="p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                        title={
                          req.priority === "URGENT"
                            ? "High Priority - Click to set Standard"
                            : "Standard Priority - Click to set High"
                        }
                        aria-label="Toggle priority"
                      >
                        <Flag
                          className={`w-4 h-4 transition-all ${
                            req.priority === "URGENT"
                              ? "text-red-600 fill-red-600 animate-pulse"
                              : "text-gray-300 hover:text-gray-500"
                          }`}
                        />
                      </button>
                      <span
                        className="cursor-pointer font-sans hover:text-[#0037b0] transition-colors"
                        onClick={() => onNavigate("briefs", req.id)}
                      >
                        {req.id}
                      </span>
                    </div>
                  </td>

                  {/* Title and Category */}
                  <td className="px-6 py-4">
                    <div className="max-w-70">
                      <p className="font-semibold text-sm text-[#191c1d] truncate group-hover:text-[#0037b0] transition-colors">
                        {req.title}
                      </p>
                      <p
                        className="text-xs text-gray-500 truncate"
                        title={req.category}
                      >
                        {req.category}
                      </p>
                    </div>
                  </td>

                  {/* MP / Member */}
                  <td className="px-6 py-4 text-sm text-[#191c1d]">
                    <span
                      className="block max-w-40 truncate whitespace-nowrap"
                      title={req.member}
                    >
                      {honourable(req.member)}
                    </span>
                  </td>

                  {/* Assigned Officer */}
                  <td
                    className="px-6 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="min-w-37.5">
                      {/* Active assignment — avatars only; names shown in the details modal */}
                      {req.teamName ? (
                        <div
                          className="flex items-center cursor-pointer w-fit"
                          onClick={() => setActiveRequest(req)}
                          title="View assigned team"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#dce1ff] flex items-center justify-center text-[10px] font-bold text-[#001551]">
                            {req.teamName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="ml-1.5 shrink-0 text-[8px] font-bold uppercase tracking-wider bg-[#dce1ff] text-[#0037b0] px-1.5 py-0.5 rounded-full">
                            Team
                          </span>
                        </div>
                      ) : req.assignedOfficerName ? (
                        <div
                          className="flex items-center cursor-pointer w-fit"
                          onClick={() => setActiveRequest(req)}
                          title="View assigned officer"
                        >
                          <div className="w-7 h-7 rounded-full bg-[#dce1ff] flex items-center justify-center text-[10px] font-bold text-[#001551]">
                            {req.assignedOfficerName
                              ?.split(" ")
                              .pop()
                              ?.slice(0, 2)
                              .toUpperCase() || "RO"}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAssignModalRequestId(req.id);
                            setAssignModalRequestTitle(req.title);
                          }}
                          className="text-[#ba1a1a] hover:text-[#ba1a1a]/80 font-semibold text-xs flex items-center gap-1 hover:underline"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Unassigned
                        </button>
                      )}

                      {/* Assignment history badges */}
                      {((req.declinedAssignments &&
                        req.declinedAssignments.length > 0) ||
                        (req.previousOfficers &&
                          req.previousOfficers.length > 0)) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {req.declinedAssignments &&
                            req.declinedAssignments.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] text-[#93000a] px-2 py-0.5 text-[9px] font-bold cursor-default"
                                title={req.declinedAssignments
                                  .map(
                                    (d) =>
                                      `${d.firstName} ${d.lastName}${d.reason ? `: ${d.reason}` : ""}`,
                                  )
                                  .join("\n")}
                              >
                                <XCircle className="w-2.5 h-2.5" />
                                {req.declinedAssignments.length} declined
                              </span>
                            )}
                          {req.previousOfficers &&
                            req.previousOfficers.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-[#dce1ff] text-[#0037b0] px-2 py-0.5 text-[9px] font-bold cursor-default"
                                title={req.previousOfficers
                                  .map(
                                    (d) =>
                                      `${d.firstName} ${d.lastName}${d.reason ? `: ${d.reason}` : ""}`,
                                  )
                                  .join("\n")}
                              >
                                <History className="w-2.5 h-2.5" />
                                {req.previousOfficers.length} reassigned
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-0.5">
                      {getStatusBadge(req.status)}
                      {nextActionHint(req.status) && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Next: {nextActionHint(req.status)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Deadline */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-0.5">
                      <span
                        className={`text-sm font-semibold ${
                          req.status === "OVERDUE"
                            ? "text-[#ba1a1a]"
                            : requestDeadlineInfo(req).kind === "soon" || requestDeadlineInfo(req).kind === "today"
                              ? "text-amber-700"
                              : "text-[#191c1d]"
                        }`}
                      >
                        {req.deadline}
                      </span>
                      {(() => {
                        const d = requestDeadlineInfo(req);
                        if (d.kind === "overdue")
                          return (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white bg-[#ba1a1a] rounded-full px-1.5 py-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Overdue {d.days}d
                            </span>
                          );
                        if (d.kind === "today")
                          return (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Due today
                            </span>
                          );
                        if (d.kind === "soon")
                          return (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5">
                              <Clock className="w-2.5 h-2.5" /> {d.days}d left
                            </span>
                          );
                        if (d.kind === "none")
                          return (
                            <span className="text-[9px] font-semibold text-gray-400 italic">No date set</span>
                          );
                        return null;
                      })()}
                    </div>
                  </td>

                  {/* Actions */}
                  <td
                    className="px-6 py-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {primaryAction(req) && (
                        <button
                          onClick={() => runPrimaryAction(req)}
                          className={`px-2.5 py-1 text-white font-bold text-[11px] rounded transition-all shadow-sm ${primaryAction(req)!.tone}`}
                        >
                          {primaryAction(req)!.label}
                        </button>
                      )}
                      <button
                        onClick={() => setActiveRequest(req)}
                        className="p-1.5 text-[#0037b0] hover:bg-blue-50 rounded transition-all"
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <div className="relative" ref={menuOpenId === req.id ? menuRef : undefined}>
                        <button
                          onClick={() => setMenuOpenId((prev) => (prev === req.id ? null : req.id))}
                          className={`p-1.5 rounded transition-all ${
                            menuOpenId === req.id
                              ? "bg-[#dce1ff] text-[#0037b0]"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                          title="Quick actions"
                          aria-label="Quick actions"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {menuOpenId === req.id && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-[#c4c5d7] rounded-lg shadow-xl py-1 text-left">
                            <button
                              onClick={() => { setMenuOpenId(null); onNavigate("briefs", req.id); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4 text-[#0037b0]" /> Review Brief
                            </button>
                            <button
                              onClick={() => { setMenuOpenId(null); setActiveRequest(req); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <FileText className="w-4 h-4 text-gray-500" /> View Details
                            </button>
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                setAssignModalRequestId(req.id);
                                setAssignModalRequestTitle(req.title);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <UserPlus className="w-4 h-4 text-gray-500" /> Assign / Reassign Staff
                            </button>
                            <div className="my-1 h-px bg-[#f0f0f2]" />
                            {["DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED", "APPROVED"].includes(req.status) && req.reportId && (
                              <button
                                onClick={() => { setMenuOpenId(null); setConfirmAction({ req, action: "REVISION_REQUESTED" }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#ba1a1a] hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Undo2 className="w-4 h-4" /> Request Revision
                              </button>
                            )}
                            {["DRAFT_SUBMITTED", "REVISION_REQUESTED", "REVISED"].includes(req.status) && (
                              <button
                                onClick={() => { setMenuOpenId(null); setConfirmAction({ req, action: "APPROVED" }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#006b2c] hover:bg-green-50 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Approve Brief
                              </button>
                            )}
                            {req.status === "APPROVED" && (
                              <button
                                onClick={() => { setMenuOpenId(null); setConfirmAction({ req, action: "DELIVERED" }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#0037b0] hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Send className="w-4 h-4" /> Mark as Delivered
                              </button>
                            )}
                            {req.status === "DELIVERED" && (
                              <button
                                onClick={() => { setMenuOpenId(null); setConfirmAction({ req, action: "CLOSED" }); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" /> Close Request
                              </button>
                            )}
                            <div className="my-1 h-px bg-[#f0f0f2]" />
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                updateRequestPriority(req.id, req.priority === "URGENT" ? "STANDARD" : "URGENT");
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Flag className={`w-4 h-4 ${req.priority === "URGENT" ? "text-red-600 fill-red-600" : "text-gray-500"}`} />
                              {req.priority === "URGENT" ? "Set Standard Priority" : "Mark as Urgent"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedRequests.length === 0 && (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-[#191c1d]">No requests match your view</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Try a different search term, or clear the active filters below to see all requests.
            </p>
            {(stageFilter || categoryFilter || tableSearch || showHighPriorityOnly || filterTab === "PENDING") && (
              <button
                onClick={() => {
                  setStageFilter(null);
                  setCategoryFilter(null);
                  setTableSearch("");
                  setShowHighPriorityOnly(false);
                  setFilterTab("ALL");
                }}
                className="mt-4 px-4 py-2 rounded bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        <Pagination
          currentPage={currentPageClamped}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredRequests.length}
          onPageChange={setCurrentPage}
          label="active requests"
          trailing={
            <span className="text-gray-400 ml-1">
              of {requests.length} total
            </span>
          }
        />
      </section>

      {activeRequest && (
        <div
          ref={activeRequestDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-request-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 lg:p-6"
          onClick={() => setActiveRequest(null)}
        >
          <div
            className="w-full max-w-[min(90vw,48rem)] max-h-[min(90vh,48rem)] rounded-xl border border-[#c4c5d7] bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#c4c5d7] bg-[#f3f4f5] px-6 py-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#dce1ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0039b5]">
                    {activeRequest.id}
                  </span>
                  {getStatusBadge(activeRequest.status)}
                  {activeRequest.priority === "URGENT" && (
                    <span className="inline-flex items-center gap-1 bg-[#ffdad6] text-[#93000a] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <Flag className="w-3 h-3 fill-[#93000a]" /> Urgent
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#191c1d]" id="admin-request-detail-title">
                  {activeRequest.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {activeRequest.category}
                </p>
              </div>
              <button
                onClick={() => setActiveRequest(null)}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                title="Close"
                aria-label="Close request details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#c4c5d7] bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Member
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#191c1d]">
                    {honourable(activeRequest.member)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#c4c5d7] bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Assigned Officer
                  </p>
                  <div className="mt-2">
                    {activeRequest.teamName ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#dce1ff] flex items-center justify-center text-[10px] font-bold text-[#001551]">
                            {activeRequest.teamName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-[#191c1d]">
                            {activeRequest.teamName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            Team
                          </span>
                        </div>
                      </>
                    ) : activeRequest.assignedOfficerName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#dce1ff] flex items-center justify-center text-[10px] font-bold text-[#001551]">
                          {activeRequest.assignedOfficerName
                            ?.split(" ")
                            .pop()
                            ?.slice(0, 2)
                            .toUpperCase() || "RO"}
                        </div>
                        <span className="text-sm font-semibold text-[#191c1d]">
                          {activeRequest.assignedOfficerName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-gray-500">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {activeRequest.declinedAssignments &&
                activeRequest.declinedAssignments.length > 0 && (
                  <div className="rounded-lg border border-[#ffdad6] bg-[#fff5f4] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#ba1a1a] flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Declined Assignments
                    </p>
                    <div className="mt-2 space-y-2">
                      {activeRequest.declinedAssignments.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#ffdad6] flex items-center justify-center text-[8px] font-bold text-[#93000a] shrink-0">
                            {d.initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#191c1d]">
                              {d.firstName} {d.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {d.reason || "No reason provided"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {activeRequest.previousOfficers &&
                activeRequest.previousOfficers.length > 0 && (
                  <div className="rounded-lg border border-[#dce1ff] bg-[#f8f9ff] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#0037b0] flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" /> Previously Assigned
                      Officers
                    </p>
                    <div className="mt-2 space-y-2">
                      {activeRequest.previousOfficers.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[8px] font-bold text-[#001551] shrink-0">
                            {d.initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#191c1d]">
                              {d.firstName} {d.lastName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {d.reason || "Reassigned"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#c4c5d7] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Priority
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#191c1d]">
                    {activeRequest.priority === "URGENT" ? (
                      <span className="inline-flex items-center gap-1.5 text-[#ba1a1a]">
                        <Flag className="w-4 h-4 fill-[#ba1a1a]" /> High
                        Priority
                      </span>
                    ) : (
                      <span className="text-[#434655]">Standard</span>
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-[#c4c5d7] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Deadline
                  </p>
                  <p
                    className={`mt-2 text-sm font-semibold ${
                      activeRequest.status === "OVERDUE"
                        ? "text-[#ba1a1a]"
                        : "text-[#191c1d]"
                    }`}
                  >
                    {activeRequest.deadline}
                    {activeRequest.status === "OVERDUE" && (
                      <span className="ml-2 inline-block bg-[#ffdad6] text-[#93000a] text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Overdue
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[#c4c5d7] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Description
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  {activeRequest.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Layout: Notifications Feed & Officer Capacity Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Directorate Activity log */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-sans font-bold text-[#191c1d] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#0037b0]" />
              Directorate Activity
            </h4>
            <button
              onClick={() => onNavigate('audit')}
              className="text-[#0037b0] text-sm font-semibold hover:underline"
            >
              View Log
            </button>
          </div>
          <div className="space-y-6">
            {paginatedActivity.map((log) => (
              <div className="flex gap-4" key={log.id}>
                <div
                  className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                    log.type === "alert"
                      ? "bg-[#ba1a1a]"
                      : log.type === "update"
                        ? "bg-[#0037b0]"
                        : "bg-[#515f74]"
                  }`}
                />
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

          <Pagination
            currentPage={activityPageClamped}
            totalPages={activityTotalPages}
            pageSize={activityPageSize}
            totalItems={history.length}
            onPageChange={setActivityPage}
            label="activity entries"
          />
        </div>

        {/* Assigned Staff Capacity directories */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-sans font-bold text-[#191c1d] flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-[#0037b0]" />
              Officer Capacity
            </h4>
            {officers.filter((o: any) => (o._count?.assignedRequests || 0) / 10 > 0.7).length > 0 && (
              <p className="text-[11px] font-semibold text-[#ba1a1a] bg-[#fff5f4] border border-[#ba1a1a]/20 rounded-lg px-2.5 py-1.5 mb-4 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {officers.filter((o: any) => (o._count?.assignedRequests || 0) / 10 > 0.7).length} officer
                {officers.filter((o: any) => (o._count?.assignedRequests || 0) / 10 > 0.7).length > 1 ? "s" : ""} at or near capacity
              </p>
            )}
            <div className="space-y-5">
              {officersError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-[#ba1a1a] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Could not load officer capacity.
                    </p>
                    <button
                      onClick={loadOfficers}
                      className="text-[10px] font-bold text-[#ba1a1a] hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : paginatedOfficers.length > 0 ? (
                paginatedOfficers.map((officer: any) => {
                  const activeCount = officer._count?.assignedRequests || 0;
                  const maxCapacity = 10;
                  const pct = Math.min((activeCount / maxCapacity) * 100, 100);
                  const atCapacity = pct > 70;
                  const barColor = atCapacity
                    ? "bg-[#ba1a1a]"
                    : pct > 40
                      ? "bg-[#0037b0]"
                      : "bg-[#006b2c]";
                  return (
                    <div
                      key={officer.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${atCapacity ? "bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/30" : "bg-blue-50 border border-blue-100 text-[#0037b0]"}`}>
                          {officer.initials}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#191c1d]">
                            {officer.firstName} {officer.lastName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Research Officer
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold flex items-center gap-1 justify-end ${atCapacity ? "text-[#ba1a1a]" : "text-gray-900"}`}>
                          {atCapacity && <AlertTriangle className="w-3 h-3" />}
                          {activeCount}/{maxCapacity}
                          {atCapacity && (
                            <span className="text-[8px] font-bold uppercase bg-[#ffdad6] text-[#93000a] px-1 py-0.5 rounded">
                              Full
                            </span>
                          )}
                        </p>
                        <div className="w-20 bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className={`${barColor} h-full`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400 italic">
                  No officers found
                </p>
              )}
            </div>

            <div className="mt-6">
              <Pagination
                currentPage={officerPageClamped}
                totalPages={officerTotalPages}
                pageSize={officerPageSize}
                totalItems={officers.length}
                onPageChange={setOfficerPage}
                label="officers"
              />
            </div>
          </div>

          <button
            onClick={() => onNavigate("members")}
            className="w-full mt-8 border border-[#0037b0] text-[#0037b0] font-semibold text-sm py-2.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
          >
            Manage Research Staff
          </button>
        </div>
      </div>
      {/* Status transition confirm modal */}
      {confirmAction && (
        <ConfirmDialog
          title={CONFIRM_META[confirmAction.action].title}
          confirmLabel={CONFIRM_META[confirmAction.action].label}
          tone={CONFIRM_META[confirmAction.action].tone}
          message={CONFIRM_META[confirmAction.action].message}
          onConfirm={() => {
            const { req, action } = confirmAction;
            updateRequestStatus(req.id, action);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Assign Modal */}
      {assignModalRequestId && (
        <AssignModal
          requestId={assignModalRequestId}
          requestTitle={assignModalRequestTitle}
          onClose={() => {
            setAssignModalRequestId(null);
            setAssignModalRequestTitle("");
          }}
        />
      )}
    </div>
  );
};
