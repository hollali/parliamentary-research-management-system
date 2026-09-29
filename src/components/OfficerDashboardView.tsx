import React, { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { ResearchRequest } from "../types";
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Sparkles,
  User,
} from "lucide-react";

interface OfficerDashboardViewProps {
  onNavigate: (view: string, targetId?: string) => void;
}

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

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-[#dce1ff] text-[#0039b5]",
  DRAFT_SUBMITTED: "bg-amber-100 text-amber-800",
  REVISION_REQUESTED: "bg-orange-100 text-orange-800",
  REVISED: "bg-orange-100 text-orange-800",
  OVERDUE: "bg-[#ffdad6] text-[#93000a]",
  APPROVED: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  MEMBER_CONFIRMED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-emerald-100 text-emerald-800",
};

export const OfficerDashboardView: React.FC<OfficerDashboardViewProps> = ({
  onNavigate,
}) => {
  const { requests, currentUser } = useApp();

  const activeRequests = useMemo(
    () =>
      requests.filter(
        (r) => !["APPROVED", "DELIVERED", "MEMBER_CONFIRMED", "CLOSED"].includes(r.status),
      ),
    [requests],
  );

  const urgentRequests = useMemo(
    () => activeRequests.filter((r) => r.priority === "URGENT"),
    [activeRequests],
  );

  const overdueRequests = useMemo(
    () =>
      activeRequests.filter((r) => {
        const t = r.deadline ? new Date(r.deadline).getTime() : NaN;
        return r.status === "OVERDUE" || (!Number.isNaN(t) && t < Date.now());
      }),
    [activeRequests],
  );

  const completedRequests = useMemo(
    () =>
      requests.filter((r) =>
        ["APPROVED", "DELIVERED", "MEMBER_CONFIRMED", "CLOSED"].includes(r.status),
      ),
    [requests],
  );

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
    return { kind: "ok" as const, days: diffDays };
  };

  const nextActionHint = (status: string): string => {
    const map: Record<string, string> = {
      SUBMITTED: "See details",
      ASSIGNED: "Start brief",
      IN_PROGRESS: "Continue brief",
      DRAFT_SUBMITTED: "Track review",
      REVISION_REQUESTED: "Address revisions",
      REVISED: "Track review",
      APPROVED: "Deliver",
      DELIVERED: "Close",
      OVERDUE: "Act now",
      CLOSED: "",
    };
    return map[status] || "";
  };

  const shortId = (id: string) => (id.length > 8 ? `O#${id.slice(0, 8)}` : id);

  const recentRequests = useMemo(() => {
    return [...activeRequests]
      .sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
      )
      .slice(0, 8);
  }, [activeRequests]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">
            Welcome back, {currentUser.name}
          </h2>
          <p className="font-sans text-sm text-[#434655] mt-1.5">
            {currentUser.title
              ? `${currentUser.title} · `
              : ""}Overview of your research assignments and daily tasks.
          </p>
        </div>
        <button
          onClick={() => onNavigate("workflow")}
          className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow flex items-center gap-2 transition-all cursor-pointer"
        >
          Open Workflow
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Active Assignments
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {activeRequests.length}
            </h3>
            <p className="text-[11px] text-[#434655] mt-1">
              In progress or awaiting action
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-[#0037b0] rounded">
            <Inbox className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Overdue
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {overdueRequests.length}
            </h3>
            <p className="text-[11px] text-[#93000a] font-semibold mt-1">
              {overdueRequests.length === 0
                ? "All on track"
                : overdueRequests.length === 1
                  ? "Needs attention now"
                  : "Need attention now"}
            </p>
          </div>
          <div className="p-3 bg-red-50 text-[#ba1a1a] rounded">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Urgent Priority
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {urgentRequests.length}
            </h3>
            <p className="text-[11px] text-[#93000a] font-semibold mt-1">
              Needs immediate attention
            </p>
          </div>
          <div className="p-3 bg-red-50 text-[#ba1a1a] rounded">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
              Completed
            </p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">
              {completedRequests.length}
            </h3>
            <p className="text-[11px] text-emerald-800 font-semibold mt-1">
              Delivered briefs
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-[#006b2c] rounded">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recent assignments */}
      <section className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#c4c5d7] bg-[#f3f4f5] flex items-center justify-between">
          <h4 className="font-sans font-semibold text-[#191c1d]">
            Your Assignments
          </h4>
          <button
            onClick={() => onNavigate("workflow")}
            className="text-xs font-bold text-[#0037b0] hover:underline flex items-center gap-1 cursor-pointer"
          >
            View all in Workflow
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentRequests.length === 0 ? (
          <div className="p-14 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">
              No active assignments
            </p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You have no pending research requests right now. New assignments
              will appear here and in your workflow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f4f5]/30 border-b border-[#c4c5d7]">
                  <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                    Request
                  </th>
                  <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">
                    Member
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
                {recentRequests.map((req) => {
                  const d = requestDeadlineInfo(req);
                  return (
                    <tr
                      key={req.id}
                      className="cursor-pointer transition-colors hover:bg-[#f3f4f5]/30"
                      onClick={() => onNavigate("workflow", req.id)}
                    >
                      <td className="px-6 py-3.5 text-xs font-bold text-[#0037b0] whitespace-nowrap">
                        {shortId(req.id)}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-[#191c1d] font-semibold max-w-56">
                        <span
                          className="block truncate"
                          title={`${req.title} — requested by ${req.member}`}
                        >
                          {req.title}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[#747686] mt-0.5">
                          <User className="w-2.5 h-2.5" />
                          {req.member || "—"}
                        </span>
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
                        <div className="flex flex-col items-start gap-0.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                              STATUS_STYLES[req.status] || "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {getStatusLabel(req.status)}
                          </span>
                          {nextActionHint(req.status) && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                              Next: {nextActionHint(req.status)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5">
                          <span
                            className={`text-xs font-semibold ${
                              d.kind === "overdue"
                                ? "text-[#ba1a1a]"
                                : d.kind === "soon" || d.kind === "today"
                                  ? "text-amber-700"
                                  : "text-[#191c1d]"
                            }`}
                          >
                            {req.deadline}
                          </span>
                          {d.kind === "overdue" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-white bg-[#ba1a1a] rounded-full px-1.5 py-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Overdue {d.days}d
                            </span>
                          )}
                          {d.kind === "today" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Due today
                            </span>
                          )}
                          {d.kind === "soon" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5">
                              <Clock className="w-2.5 h-2.5" /> {d.days}d left
                            </span>
                          )}
                          {d.kind === "ok" && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-800 bg-emerald-50 rounded-full px-1.5 py-0.5">
                              <Clock className="w-2.5 h-2.5" /> {d.days} d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate("workflow", req.id);
                          }}
                          className="text-[#0037b0] hover:underline text-xs font-bold flex items-center justify-end gap-1 cursor-pointer"
                        >
                          <span>Work on it</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};