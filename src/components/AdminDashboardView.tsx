import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { getOfficers } from "../lib/api";
import { honourable } from "../lib/format";
import { ResearchRequest } from "../types";
import { AssignModal } from "./AssignModal";
import { ExportButton } from "./ExportButton";
import { Pagination } from "./Pagination";
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
  Pencil,
  MoreVertical,
  Activity,
  CheckCircle,
  MoreHorizontal,
  Flag,
  X,
  XCircle,
  History,
} from "lucide-react";

interface AdminDashboardViewProps {
  onNavigate: (view: string, targetId?: string) => void;
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [activityPage, setActivityPage] = useState(1);
  const activityPageSize = 5;
  const [officerPage, setOfficerPage] = useState(1);
  const officerPageSize = 5;

  useEffect(() => {
    getOfficers()
      .then((data) => {
        if (Array.isArray(data)) setOfficers(data);
      })
      .catch(() => console.warn("Failed to load officers"));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, showHighPriorityOnly]);

  useEffect(() => {
    setActivityPage(1);
  }, [history.length]);

  useEffect(() => {
    setOfficerPage(1);
  }, [officers.length]);

  useEffect(() => {
    if (!activeRequest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveRequest(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [activeRequest]);

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

  // Filter requests for display
  const filteredRequests = requests.filter((req) => {
    if (showHighPriorityOnly && req.priority !== "URGENT") return false;
    if (
      filterTab === "PENDING" &&
      !["SUBMITTED", "ASSIGNED"].includes(req.status)
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
            Pending Review
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
      case "REVISED":
        return (
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Revision
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
            Completed
          </span>
        );
      case "DELIVERED":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
            Delivered
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
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">
            Administrative Overview
          </h2>
          <p className="font-sans text-sm text-[#434655] mt-1">
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
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 hover:border-blue-500/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#d5e3fd] rounded text-[#001551]">
              <FileText className="w-5 h-5" />
            </div>
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
        </div>

        {/* Assigned */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 hover:border-blue-500/40 transition-all shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#dce1ff] rounded text-[#0039b5]">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">
            Assigned
          </p>
          <h3 className="text-3xl font-bold text-[#191c1d] mt-1">
            {totalAssigned}
          </h3>
          <p className="text-xs text-gray-500 mt-2 italic">
            Active research in pipeline
          </p>
        </div>

        {/* In Progress */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 hover:border-blue-500/40 transition-all shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-[#7ffc97]/20 rounded text-[#00501f]">
              <RefreshCw className="w-5 h-5" />
            </div>
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
        </div>

        {/* Overdue */}
        <div className="bg-white border border-[#ba1a1a]/30 rounded-lg p-6 hover:border-[#ba1a1a]/50 transition-all shadow-sm">
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
        </div>
      </div>

      {/* Request Management Table */}
      <section className="bg-white border border-[#c4c5d7] rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c5d7] flex flex-col md:flex-row justify-between items-start md:items-center bg-[#f3f4f5] gap-4">
          <h4 className="font-sans font-semibold text-[#191c1d]">
            Recent Research Requests
          </h4>
          <div className="flex items-center gap-4 flex-wrap w-full md:w-auto md:justify-end">
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
                Pending Review
              </button>
            </div>
          </div>
        </div>

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
                  <td className="px-6 py-4">{getStatusBadge(req.status)}</td>

                  {/* Deadline */}
                  <td
                    className={`px-6 py-4 text-sm font-semibold whitespace-nowrap ${req.status === "OVERDUE" ? "text-[#ba1a1a]" : "text-[#191c1d]"}`}
                  >
                    {req.deadline}
                  </td>

                  {/* Actions */}
                  <td
                    className="px-6 py-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setActiveRequest(req)}
                        className="p-1.5 text-[#0037b0] hover:bg-blue-50 rounded transition-all"
                        title="View Details"
                        aria-label="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setAssignModalRequestId(req.id);
                          setAssignModalRequestTitle(req.title);
                        }}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-all"
                        title="Reassign Staff"
                        aria-label="Reassign Staff"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                <h3 className="text-lg font-bold text-[#191c1d]">
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
            <button className="text-[#0037b0] text-sm font-semibold hover:underline">
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
            <h4 className="font-sans font-bold text-[#191c1d] mb-6">
              Officer Capacity
            </h4>
            <div className="space-y-5">
              {paginatedOfficers.length > 0 ? (
                paginatedOfficers.map((officer: any) => {
                  const activeCount = officer._count?.assignedRequests || 0;
                  const maxCapacity = 10;
                  const pct = Math.min((activeCount / maxCapacity) * 100, 100);
                  const barColor =
                    pct > 70
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
                        <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-[#0037b0] text-xs">
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
                        <p className="text-xs font-bold text-gray-900">
                          {activeCount}/{maxCapacity}
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
