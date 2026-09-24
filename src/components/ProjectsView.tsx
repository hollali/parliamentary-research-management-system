import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { downloadFile, getAttachments, getWorkloadStats } from "../lib/api";
import { honourable } from "../lib/format";
import { formatRequestStatus } from "../lib/status";
import { toPlainText } from "../lib/content";
import { useToast } from "../lib/toast";
import { AssignModal } from "./AssignModal";
import {
  Search,
  UserPlus,
  Clock,
  ChevronDown,
  Filter,
  X,
  Eye,
  FileSpreadsheet,
  FileText,
  Download,
  ShieldCheck,
  Flag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Paperclip,
  AlertTriangle,
  Users,
  MoreHorizontal,
} from "lucide-react";
import { ExportButton } from "./ExportButton";
import { Pagination } from "./Pagination";
import { Document, Packer, Paragraph, TextRun } from "docx";

interface ProjectsViewProps {
  onNavigate: (view: string, id: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigate }) => {
  const {
    requests,
    assignRequest,
    updateRequestPriority,
    extendRequestDeadline,
    currentUser,
  } = useApp();
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [assignModalRequestId, setAssignModalRequestId] = useState<
    string | null
  >(null);
  const [assignModalRequestTitle, setAssignModalRequestTitle] =
    useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [sortField, setSortField] = useState<string>("dateSubmittedRaw");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [viewRequest, setViewRequest] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [previewRequest, setPreviewRequest] = useState<any | null>(null);
  const [previewType, setPreviewType] = useState<"draft" | "attachment">(
    "draft",
  );
  const [previewAttachmentName, setPreviewAttachmentName] = useState<
    string | null
  >(null);
  const [activePreviewTab, setActivePreviewTab] = useState<number>(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
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

  // Reset active tab whenever preview selection changes
  React.useEffect(() => {
    setActivePreviewTab(0);
  }, [previewRequest, previewType, previewAttachmentName]);

  const parsedSections = React.useMemo(() => {
    if (!previewRequest) return [];

    const text: string =
      toPlainText(previewRequest.content) ||
      `
      1. Executive Summary: This research document was commissioned by ${honourable(previewRequest.member)} to assess the statutory framework of ${previewRequest.title}.
      
      The analysis explores regulatory blockages, regional implementation histories, and the administrative feasibility of proposed adjustments.
      
      2. Legislative Context: Under current parliamentary standing orders, policy submissions require dual-directorate clearance. 
      This request aligns with current national growth policies and addresses critical gaps in enforcement and standard-setting.
      
      3. Financial Scope & Outlook: Fiscal allocations are projected to remain within standard ministerial limits. 
      A structured budget assessment suggests a 4.2% optimization index if structural recommendations are enacted in full.
      
      4. Stakeholders & Precedents: Principal consultants include ministerial liaison officers, municipal authority chairs, and statistical agency directors.
    `;

    // Try to parse sections dynamically
    const sections: { title: string; content: string[] }[] = [];
    const lines = text.split("\n");
    let currentSection: { title: string; content: string[] } | null = null;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check if line looks like a header
      if (
        /^\d+\.\s+\w+/.test(trimmed) ||
        trimmed.startsWith("I.") ||
        trimmed.startsWith("II.") ||
        trimmed.startsWith("III.") ||
        trimmed.startsWith("IV.") ||
        trimmed.startsWith("V.")
      ) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: trimmed, content: [] };
      } else {
        if (!currentSection) {
          currentSection = {
            title: "General Information & Brief Overview",
            content: [],
          };
        }
        currentSection.content.push(trimmed);
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }, [previewRequest]);

  const spreadsheetData = React.useMemo(() => {
    if (!previewRequest || !previewRequest.attachments) return null;

    const xlsxFile = previewRequest.attachments.find((a: any) =>
      a.name?.endsWith(".xlsx"),
    );
    if (!xlsxFile) return null;

    return {
      title: xlsxFile.name,
      headers: ["File Name", "Type", "Size", "Status"],
      rows: [
        [
          xlsxFile.name,
          xlsxFile.type || "xlsx",
          xlsxFile.size || "N/A",
          "Attached",
        ],
      ],
      totals: ["Total", "1 file", "—", "—"],
    };
  }, [previewRequest]);

  const pdfPages = React.useMemo(() => {
    if (!previewRequest) return [];

    const content: string = toPlainText(previewRequest.content);
    if (!content) {
      return [
        {
          pageNum: 1,
          title: "No content available",
          content: ["Report content has not been uploaded yet."],
        },
      ];
    }

    const lines = content.split("\n").filter((l: string) => l.trim());
    const pageSize = 15;
    const pages: { pageNum: number; title: string; content: string[] }[] = [];

    for (let i = 0; i < lines.length; i += pageSize) {
      const pageLines = lines.slice(i, i + pageSize);
      const pageNum = pages.length + 1;
      pages.push({
        pageNum,
        title: `Page ${pageNum}`,
        content: pageLines,
      });
    }

    return pages.length > 0
      ? pages
      : [
          {
            pageNum: 1,
            title: "Document",
            content: [content],
          },
        ];
  }, [previewRequest]);

  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    requests.forEach((req) => {
      if (req.category) cats.add(req.category);
    });
    return Array.from(cats).sort();
  }, [requests]);

  const statuses = [
    { value: "SUBMITTED", label: "Submitted" },
    { value: "ASSIGNED", label: "Assigned" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "DRAFT_SUBMITTED", label: "Draft Submitted" },
    { value: "REVISION_REQUESTED", label: "Revision Requested" },
    { value: "REVISED", label: "Revised" },
    { value: "OVERDUE", label: "Overdue" },
    { value: "APPROVED", label: "Approved" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "CLOSED", label: "Closed" },
  ];

  const filteredRequests = React.useMemo(() => {
    return requests.filter((req) => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        req.id.toLowerCase().includes(searchLower) ||
        req.title.toLowerCase().includes(searchLower) ||
        (req.member || "").toLowerCase().includes(searchLower) ||
        (req.assignedOfficerName &&
          req.assignedOfficerName.toLowerCase().includes(searchLower));

      const matchesCategory =
        !selectedCategory || req.category === selectedCategory;
      const matchesStatus = !selectedStatus || req.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [requests, searchQuery, selectedCategory, selectedStatus]);

  const isFiltered =
    searchQuery !== "" || selectedCategory !== "" || selectedStatus !== "";
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedStatus("");
  };

  const extendDeadlineStr = (currentDeadline: string, days: number): string => {
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
  };

  const getProgressPercentage = (status: string): number => {
    switch (status) {
      case "SUBMITTED":
        return 15;
      case "ASSIGNED":
        return 30;
      case "IN_PROGRESS":
        return 55;
      case "REVISION_REQUESTED":
        return 75;
      case "REVISED":
        return 85;
      case "OVERDUE":
        return 40;
      case "APPROVED":
        return 100;
      default:
        return 0;
    }
  };

  const getProgressColor = (status: string): string => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-600";
      case "OVERDUE":
        return "bg-[#ba1a1a]";
      case "REVISION_REQUESTED":
      case "REVISED":
        return "bg-amber-500";
      default:
        return "bg-[#0037b0]";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Submitted
          </span>
        );
      case "ASSIGNED":
        return (
          <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Assigned
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            In Progress
          </span>
        );
      case "DRAFT_SUBMITTED":
        return (
          <span className="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Draft Submitted
          </span>
        );
      case "REVISION_REQUESTED":
        return (
          <span className="bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap animate-pulse">
            Revision Requested
          </span>
        );
      case "REVISED":
        return (
          <span className="bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Revised
          </span>
        );
      case "OVERDUE":
        return (
          <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Overdue
          </span>
        );
      case "APPROVED":
        return (
          <span className="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            Approved
          </span>
        );
      default:
        return (
          <span className="bg-gray-100 text-gray-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
            {formatRequestStatus(status)}
          </span>
        );
    }
  };

  const requestDeadlineInfo = (req: any) => {
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

  const nextActionHint = (status: string): string => {
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
    };
    return map[status] || "";
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3 h-3 text-[#0037b0]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#0037b0]" />
    );
  };

  const sortedRequests = React.useMemo(() => {
    const arr = [...filteredRequests];
    arr.sort((a, b) => {
      if (sortField === "dateSubmittedRaw") {
        const aTime = new Date(a.dateSubmittedRaw || 0).getTime();
        const bTime = new Date(b.dateSubmittedRaw || 0).getTime();
        return sortDirection === "asc" ? aTime - bTime : bTime - aTime;
      }
      let aVal: string, bVal: string;
      switch (sortField) {
        case "id":
          aVal = a.id;
          bVal = b.id;
          break;
        case "title":
          aVal = a.title;
          bVal = b.title;
          break;
        case "member":
          aVal = a.member;
          bVal = b.member;
          break;
        case "assignedOfficerName":
          aVal = a.assignedOfficerName || "zzz";
          bVal = b.assignedOfficerName || "zzz";
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "deadline":
          aVal = a.deadline;
          bVal = b.deadline;
          break;
        default:
          aVal = a.id;
          bVal = b.id;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRequests, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedRequests.length / pageSize);
  const paginatedRequests = sortedRequests.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus]);

  const handleDownload = async (e: React.MouseEvent, req: any) => {
    e.stopPropagation();
    if (downloadingId) return;

    setDownloadingId(req.id);

    try {
      const attachments = req.attachments || [];
      if (attachments.length > 0) {
        for (const att of attachments) {
          if (att.id) {
            await downloadFile(att.id, att.name);
          }
        }
      } else if (req.content) {
        const paragraphs = toPlainText(req.content).split("\n").map(
          (line: string) =>
            new Paragraph({
              children: [new TextRun(line)],
            })
        );
        const doc = new Document({
          sections: [{ properties: {}, children: paragraphs }],
        });
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${req.title || req.id}_brief.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        return;
      }
    } catch (err) {
      toast.error("Failed to download file");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center">
          <h3 className="font-sans font-bold text-gray-900">
            Research Requests
          </h3>
          <span className="text-xs text-gray-500 font-semibold">
            {isFiltered
              ? `${filteredRequests.length} of ${requests.length} entries`
              : `${requests.length} total entries`}
          </span>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Left Search input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, title, or officer name..."
              className="w-full pl-9 pr-8 py-1.5 border border-[#c4c5d7] rounded-md text-xs font-sans placeholder-gray-400 focus:outline-none focus:border-[#0037b0] focus:ring-1 focus:ring-[#0037b0] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Research Topic Filter */}
            <div className="relative min-w-35">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-gray-700 focus:outline-none focus:border-[#0037b0] appearance-none cursor-pointer"
              >
                <option value="">All Research Topics</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Status Filter */}
            <div className="relative min-w-37.5">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-gray-700 focus:outline-none focus:border-[#0037b0] appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                {statuses.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Clear Filters Button */}
            {isFiltered && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-[#ba1a1a]/40 hover:border-[#ba1a1a] text-[#ba1a1a] hover:bg-red-50/50 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f4f5]/50 border-b border-[#c4c5d7]">
                <th
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort("id")}
                >
                  <span className="flex items-center gap-1">
                    Request ID {getSortIcon("id")}
                  </span>
                </th>
                <th
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort("title")}
                >
                  <span className="flex items-center gap-1">
                    Title {getSortIcon("title")}
                  </span>
                </th>
                <th
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort("member")}
                >
                  <span className="flex items-center gap-1">
                    Member {getSortIcon("member")}
                  </span>
                </th>
                {currentUser.role !== "MP" && (
                  <th
                    className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                    onClick={() => handleSort("assignedOfficerName")}
                  >
                    <span className="flex items-center gap-1">
                      Assigned Officer {getSortIcon("assignedOfficerName")}
                    </span>
                  </th>
                )}
                <th
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort("status")}
                >
                  <span className="flex items-center gap-1">
                    Status {getSortIcon("status")}
                  </span>
                </th>
                <th
                  className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider cursor-pointer hover:text-[#0037b0] transition-colors select-none"
                  onClick={() => handleSort("deadline")}
                >
                  <span className="flex items-center gap-1">
                    Deadline {getSortIcon("deadline")}
                  </span>
                </th>
                <th className="px-4 lg:px-6 py-3.5 text-xs font-bold text-[#747686] uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRequests.length === 0 ? (
                <tr>
                  <td colSpan={currentUser.role !== "MP" ? 7 : 6} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <Filter className="w-8 h-8 text-gray-400 animate-pulse" />
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-gray-900">
                          No request records match your criteria
                        </h5>
                        <p className="text-[10px] text-gray-500 max-w-sm">
                          Try modifying your search text, selecting a different
                          category, or clearing the active filters.
                        </p>
                      </div>
                      <button
                        onClick={clearFilters}
                        className="px-3 py-1.5 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm transition-all cursor-pointer"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => {
                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-[#f3f4f5]/40 transition-colors group cursor-pointer"
                      onClick={() => setViewRequest(req)}
                    >
                      {/* Request ID & Priority */}
                      <td
                        className="px-4 lg:px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateRequestPriority(
                                req.id,
                                req.priority === "URGENT"
                                  ? "STANDARD"
                                  : "URGENT",
                              )
                            }
                            className="p-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
                            title={
                              req.priority === "URGENT"
                                ? "High Priority — Click to set Standard"
                                : "Standard Priority — Click to set High"
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
                          <span className="bg-[#dce1ff] text-[#0039b5] text-[10px] font-bold px-2 py-0.5 rounded font-sans">
                            {req.id}
                          </span>
                          {req.priority === "URGENT" && (
                            <span className="bg-red-50 text-red-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-red-200 animate-pulse uppercase tracking-wider">
                              Urgent
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Title */}
                      <td className="px-4 lg:px-6 py-4">
                        <div className="max-w-[320px]">
                          <p className="font-semibold text-sm text-[#191c1d] truncate group-hover:text-[#0037b0] transition-colors">
                            {req.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {req.category}
                          </p>
                        </div>
                      </td>

                      {/* Member */}
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex items-center gap-2 min-w-0 max-w-[180px]">
                          <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-sm text-[#434655] truncate" title={req.member}>
                            {honourable(req.member)}
                          </span>
                        </div>
                      </td>

                      {/* Assigned Officer */}
                      {currentUser.role !== "MP" && (
                        <td className="px-4 lg:px-6 py-4">
                          <div className="min-w-0 max-w-[160px]">
                            {req.teamName ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[9px] font-bold text-[#001551] shrink-0">
                                  {req.teamName.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm text-[#434655] truncate" title={req.teamName}>
                                  {req.teamName}
                                </span>
                              </div>
                            ) : req.assignedOfficerName ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[9px] font-bold text-[#001551] shrink-0">
                                  {req.assignedOfficerName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "RO"}
                                </div>
                                <span className="text-sm text-[#434655] truncate" title={req.assignedOfficerName}>
                                  {req.assignedOfficerName}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssignModalRequestId(req.id);
                                  setAssignModalRequestTitle(req.title);
                                }}
                                className="text-[#ba1a1a] hover:text-[#ba1a1a]/80 font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Unassigned
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Status */}
                      <td className="px-4 lg:px-6 py-4">
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
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
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
                        className="px-4 lg:px-6 py-4 text-right min-w-30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => setViewRequest(req)}
                            className="p-2.5 text-[#0037b0] hover:bg-blue-50 rounded-lg transition-all cursor-pointer ring-1 ring-blue-100 shadow-sm"
                            title="View Details"
                            aria-label="View Details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <div className="relative" ref={menuOpenId === req.id ? menuRef : undefined}>
                            <button
                              onClick={() => setMenuOpenId((prev) => (prev === req.id ? null : req.id))}
                              className={`p-1.5 rounded transition-all cursor-pointer ${
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
                              <div className="absolute right-0 top-full mt-1 z-30 w-60 bg-white border border-[#c4c5d7] rounded-lg shadow-xl py-1 text-left">
                                <button
                                  onClick={() => { setMenuOpenId(null); setViewRequest(req); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-4 h-4 text-gray-500" /> View Details
                                </button>
                                {(currentUser.role === "ADMIN" || currentUser.role === "MP") && (
                                  <button
                                    onClick={() => { setMenuOpenId(null); onNavigate("briefs", req.id); }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                                  >
                                    <FileText className="w-4 h-4 text-[#0037b0]" /> Open Full Brief
                                  </button>
                                )}
                                {currentUser.role !== "MP" && (
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
                                )}
                                <div className="my-1 h-px bg-[#f0f0f2]" />
                                <div className="px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                  Extend Due Date
                                </div>
                                {[7, 14].map((days) => (
                                  <button
                                    key={days}
                                    onClick={async () => {
                                      setMenuOpenId(null);
                                      const newDate = extendDeadlineStr(req.deadline, days);
                                      const ok = await extendRequestDeadline(req.id, newDate);
                                      if (ok) {
                                        toast.success(`Deadline extended to ${newDate}.`);
                                      } else {
                                        toast.error("Failed to extend the deadline.");
                                      }
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer"
                                  >
                                    <Clock className="w-4 h-4 text-gray-500" /> +{days} Days
                                  </button>
                                ))}
                                <div className="my-1 h-px bg-[#f0f0f2]" />
                                {(() => {
                                  const hasDownloadable =
                                    (req.attachments && req.attachments.length > 0) ||
                                    !!req.content;
                                  return (
                                    <button
                                      onClick={(e) => { setMenuOpenId(null); handleDownload(e, req); }}
                                      disabled={downloadingId !== null || !hasDownloadable}
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#191c1d] hover:bg-blue-50 transition-colors cursor-pointer ${
                                        !hasDownloadable ? "opacity-40 cursor-not-allowed" : ""
                                      }`}
                                    >
                                      <Download className={`w-4 h-4 ${downloadingId === req.id ? "text-amber-600 animate-pulse" : "text-gray-500"}`} />
                                      {downloadingId === req.id ? "Downloading..." : "Download Brief"}
                                    </button>
                                  );
                                })()}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedRequests.length}
          onPageChange={setCurrentPage}
          label="entries"
          trailing={
            isFiltered && (
              <span className="text-gray-400 ml-1">
                (filtered from {requests.length})
              </span>
            )
          }
          actions={
            <ExportButton
              data={filteredRequests.map((req) => ({
                id: req.id,
                title: req.title,
                member: honourable(req.member),
                ...(currentUser.role !== "MP" && {
                  officer: req.assignedOfficerName || "Unassigned",
                }),
                status: formatRequestStatus(req.status),
                deadline: req.deadline,
                category: req.category,
                priority: req.priority,
              }))}
              columns={[
                { key: "id", label: "Request ID" },
                { key: "title", label: "Title" },
                { key: "member", label: "Member" },
                ...(currentUser.role !== "MP"
                  ? [{ key: "officer", label: "Assigned Officer" }]
                  : []),
                { key: "status", label: "Status" },
                { key: "deadline", label: "Deadline" },
                { key: "category", label: "Research Topic" },
                { key: "priority", label: "Priority" },
              ]}
              filename="Research_Requests"
              title="Research Requests"
            />
          }
        />
      </div>

      {/* View Detail Modal */}
      {viewRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setViewRequest(null)}
        >
          <div
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <span className="bg-[#dce1ff] text-[#0039b5] text-xs font-bold px-2.5 py-1 rounded">
                  {viewRequest.id}
                </span>
                <div>
                  <h3 className="font-sans font-bold text-gray-900 text-sm">
                    {viewRequest.title}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                    {viewRequest.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewRequest(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status & Priority Row */}
              <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(viewRequest.status)}
                {viewRequest.priority === "URGENT" && (
                  <span className="bg-red-50 text-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-red-200 animate-pulse uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Urgent Priority
                  </span>
                )}
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#434655]">
                  <span className="uppercase tracking-wider">
                    Workflow Progress
                  </span>
                  <span className="text-[#0037b0]">
                    {getProgressPercentage(viewRequest.status)}%
                  </span>
                </div>
                <div
                  className={`w-full h-2 bg-gray-100 rounded-full overflow-hidden ${viewRequest.status === "REVISION_REQUESTED" ? "ring-1 ring-amber-300" : ""}`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(viewRequest.status)}`}
                    style={{
                      width: `${getProgressPercentage(viewRequest.status)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Member (MP)
                  </span>
                  <p className="text-sm font-semibold text-[#191c1d]">
                    {honourable(viewRequest.member)}
                  </p>
                </div>
                {currentUser.role !== "MP" && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Assigned Officer
                    </span>
                    {viewRequest.teamName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[9px] font-bold text-[#001551]">
                          {viewRequest.teamName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#191c1d]">
                            {viewRequest.teamName}
                          </p>
                        </div>
                      </div>
                    ) : viewRequest.assignedOfficerName ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#dce1ff] flex items-center justify-center text-[9px] font-bold text-[#001551]">
                          {viewRequest.assignedOfficerName
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "RO"}
                        </div>
                        <p className="text-sm font-semibold text-[#191c1d]">
                          {viewRequest.assignedOfficerName}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setViewRequest(null);
                          setAssignModalRequestId(viewRequest.id);
                          setAssignModalRequestTitle(viewRequest.title);
                        }}
                        className="text-[#ba1a1a] hover:text-[#ba1a1a]/80 font-semibold text-xs flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Unassigned — Click to Assign
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Deadline
                  </span>
                  <p
                    className={`text-sm font-semibold ${viewRequest.status === "OVERDUE" ? "text-[#ba1a1a]" : "text-[#191c1d]"}`}
                  >
                    {viewRequest.deadline}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Date Submitted
                  </span>
                  <p className="text-sm font-semibold text-[#191c1d]">
                    {viewRequest.dateSubmitted}
                  </p>
                </div>
              </div>

              {/* Description */}
              {viewRequest.description && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Description
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded border border-gray-100">
                    {viewRequest.description}
                  </p>
                </div>
              )}

              {/* Attachments & Drafts */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Paperclip className="w-3 h-3" />
                  Attached Files & Drafts
                </span>
                <div className="space-y-1.5">
                  <div
                    onClick={() => {
                      setViewRequest(null);
                      setPreviewRequest(viewRequest);
                      setPreviewType("draft");
                      setPreviewAttachmentName(null);
                    }}
                    className="flex items-center justify-between p-2.5 bg-blue-50/40 hover:bg-blue-50/80 border border-blue-100/50 rounded text-xs text-gray-700 cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#0037b0] shrink-0" />
                      <span className="font-semibold text-gray-800 truncate">
                        Official Briefing Draft
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] bg-blue-100 text-[#0037b0] px-1.5 py-0.5 rounded font-bold">
                        Draft v{viewRequest.draftVersion || 1}
                      </span>
                      <Eye className="w-3.5 h-3.5 text-[#0037b0]" />
                    </div>
                  </div>
                  {viewRequest.attachments &&
                    viewRequest.attachments.map((att: any, attIdx: number) => {
                      const isExcel = att.type === "xlsx";
                      return (
                        <div
                          key={attIdx}
                          onClick={() => {
                            setViewRequest(null);
                            setPreviewRequest(viewRequest);
                            setPreviewType("attachment");
                            setPreviewAttachmentName(att.name);
                          }}
                          className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/50 rounded text-xs text-gray-700 cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isExcel ? (
                              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-red-600 shrink-0" />
                            )}
                            <span className="font-medium truncate text-gray-700">
                              {att.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] text-gray-400 font-semibold">
                              {att.size}
                            </span>
                            <Eye className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-between items-center shrink-0">
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Encrypted Sandbox View
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewRequest(null)}
                  className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold py-1.5 px-4 rounded transition-all cursor-pointer"
                >
                  Close
                </button>
                {(currentUser.role === "ADMIN" || currentUser.role === "MP") && (
                  <button
                    onClick={() => {
                      setViewRequest(null);
                      onNavigate("briefs", viewRequest.id);
                    }}
                    className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-bold py-1.5 px-4 rounded transition-all cursor-pointer"
                  >
                    Open Full Brief
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Preview Modal */}
      {previewRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setPreviewRequest(null)}
        >
          <div
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-[#dce1ff] text-[#0039b5] text-xs font-bold px-2.5 py-1 rounded">
                  {previewRequest.id}
                </div>
                <div>
                  <h3 className="font-sans font-bold text-gray-900 text-sm flex items-center gap-2">
                    <span>Quick Preview:</span>
                    <span className="text-gray-600 font-medium">
                      {previewType === "draft"
                        ? "Official Briefing Draft"
                        : previewAttachmentName}
                    </span>
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5 max-w-xl truncate">
                    {previewRequest.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewRequest(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
                title="Close Preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden flex bg-slate-50">
              {/* Draft Preview Layout */}
              {previewType === "draft" && (
                <div className="flex-1 flex overflow-hidden">
                  {/* Left Sidebar of Draft Sections */}
                  <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto p-4 flex flex-col gap-1.5 shrink-0">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Brief Chapters / Sections
                    </div>
                    {parsedSections.map((sec, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePreviewTab(idx)}
                        className={`text-left px-3 py-2 rounded text-xs transition-all font-semibold ${
                          activePreviewTab === idx
                            ? "bg-[#dce1ff] text-[#0039b5] shadow-sm"
                            : "hover:bg-slate-50 text-gray-700"
                        }`}
                      >
                        <div className="truncate font-sans font-bold">
                          {sec.title}
                        </div>
                        <div className="text-[9px] text-gray-400 font-normal truncate mt-0.5">
                          {sec.content[0] || "View details..."}
                        </div>
                      </button>
                    ))}

                    <div className="mt-auto border-t border-gray-100 pt-4 space-y-2">
                      <div className="p-2.5 bg-[#f8f9fa] border border-gray-200 rounded text-[10px] space-y-1">
                        <span className="font-bold text-gray-700 block">
                          Security Classification
                        </span>
                        <span className="text-red-700 font-extrabold text-[9px] tracking-wider uppercase block">
                          OFFICIAL-SENSITIVE
                        </span>
                        <span className="text-gray-500 block">
                          Restricted to active MPs and assigned legal
                          investigators.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Main Document Content */}
                  <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="max-w-2xl w-full bg-white shadow-md border border-gray-200/60 rounded-lg p-10 font-sans min-h-full relative space-y-6 flex flex-col">
                      {/* Letterhead decoration */}
                      <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                        <div>
                          <h4 className="text-[11px] font-bold text-gray-900 tracking-widest uppercase">
                            Parliamentary Research Services
                          </h4>
                          <span className="text-[9px] text-gray-500 font-semibold uppercase">
                            Republic of Ghana • Joint Secretariat Vault
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold uppercase tracking-wider">
                            SECURE DRAFT
                          </span>
                        </div>
                      </div>

                      {/* Title of active segment */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                          Active Chapter
                        </span>
                        <h2 className="text-sm font-bold text-gray-900 font-sans border-b border-gray-100 pb-1">
                          {parsedSections[activePreviewTab]?.title}
                        </h2>
                      </div>

                      {/* Content paragraphs */}
                      <div className="text-xs text-gray-700 leading-relaxed font-sans space-y-4 flex-1">
                        {parsedSections[activePreviewTab]?.content.map(
                          (p, pIdx) => (
                            <p key={pIdx} className="text-justify font-sans">
                              {p}
                            </p>
                          ),
                        )}
                      </div>

                      {/* Signature block / stamp placeholder */}
                      <div className="pt-8 border-t border-gray-100 flex justify-between items-end text-[9px] text-gray-400">
                        <div>
                          <p className="font-bold text-gray-600">
                            DIRECTORATE SIGN-OFF:
                          </p>
                          <p className="font-semibold text-[#0037b0] mt-1">
                            Verified: RSA-4096 Secure Signature
                          </p>
                          <p className="text-gray-400 font-medium">
                            Date Verified: {new Date().toLocaleDateString()}
                          </p>
                        </div>
                        <div className="w-16 h-16 rounded-full border-4 border-amber-600/20 flex items-center justify-center text-amber-600/30 select-none font-bold rotate-12 uppercase text-[7px] text-center p-1 font-mono">
                          Official Draft Archive
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Excel Spreadsheet Preview Layout */}
              {previewType === "attachment" &&
                previewAttachmentName?.endsWith(".xlsx") &&
                spreadsheetData && (
                  <div className="flex-1 flex flex-col p-6 overflow-hidden">
                    {/* Spreadsheet toolbar */}
                    <div className="bg-white border border-[#c4c5d7] rounded-t-lg px-4 py-2 flex items-center justify-between shrink-0 border-b-0">
                      <div className="flex items-center gap-2">
                        <div className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase flex items-center gap-1">
                          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                          <span>Interactive Excel Viewer</span>
                        </div>
                        <span className="text-xs font-bold text-gray-700">
                          {spreadsheetData.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        Sheet1 / Auto-calculated
                      </div>
                    </div>

                    {/* Spreadsheet Grid container */}
                    <div className="flex-1 bg-white border border-[#c4c5d7] rounded-b-lg overflow-auto">
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="bg-slate-100 border-b border-gray-200">
                            <th className="w-12 bg-slate-200 border-r border-slate-300 text-center font-mono text-[9px] text-gray-500 py-1 select-none"></th>
                            {spreadsheetData.headers.map((h, hIdx) => (
                              <th
                                key={hIdx}
                                className="px-4 py-1.5 border-r border-slate-200 bg-slate-100 text-gray-600 font-bold text-[10px] uppercase tracking-wider truncate"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Data Rows */}
                          {spreadsheetData.rows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="border-b border-gray-100 hover:bg-slate-50 transition-colors"
                            >
                              <td className="bg-slate-50 border-r border-slate-200 text-center font-mono text-[9px] text-gray-400 py-1 select-none font-bold">
                                {rIdx + 1}
                              </td>
                              {row.map((val, cIdx) => {
                                const isNumeric = !isNaN(
                                  parseFloat(val.replace(/[%,M\s]/g, "")),
                                );
                                return (
                                  <td
                                    key={cIdx}
                                    className={`px-4 py-2 border-r border-gray-100 text-[11px] font-mono truncate ${
                                      isNumeric
                                        ? "text-right text-gray-800"
                                        : "text-gray-600"
                                    }`}
                                  >
                                    {val}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Blank rows to look like a real Excel sheet */}
                          {Array.from({ length: 6 }).map((_, bIdx) => (
                            <tr
                              key={`blank-${bIdx}`}
                              className="border-b border-gray-50 bg-white"
                            >
                              <td className="bg-slate-50 border-r border-slate-100 text-center font-mono text-[9px] text-gray-300 py-1 select-none">
                                {spreadsheetData.rows.length + bIdx + 1}
                              </td>
                              {spreadsheetData.headers.map((_, hIdx) => (
                                <td
                                  key={hIdx}
                                  className="px-4 py-2 border-r border-gray-50 text-[11px] font-mono"
                                ></td>
                              ))}
                            </tr>
                          ))}

                          {/* Totals Summary Row */}
                          <tr className="bg-emerald-50/50 border-t-2 border-emerald-600/30 font-bold">
                            <td className="bg-emerald-100/50 border-r border-emerald-200 text-center font-mono text-[9px] text-emerald-800 py-1.5 select-none font-black">
                              ∑
                            </td>
                            {spreadsheetData.totals.map((total, tIdx) => {
                              const isNumeric =
                                total.includes("M") ||
                                total.includes("%") ||
                                total.includes(",");
                              return (
                                <td
                                  key={tIdx}
                                  className={`px-4 py-2 border-r border-emerald-100 text-[11px] text-emerald-900 font-bold font-mono ${
                                    isNumeric ? "text-right" : "text-left"
                                  }`}
                                >
                                  {total}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* PDF/Word Document Preview Layout */}
              {previewType === "attachment" &&
                !previewAttachmentName?.endsWith(".xlsx") && (
                  <div className="flex-1 flex overflow-hidden">
                    {/* Left sidebar for page directories */}
                    <div className="w-56 border-r border-gray-200 bg-white overflow-y-auto p-4 flex flex-col gap-1.5 shrink-0">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Document Pages
                      </div>
                      {pdfPages.map((page, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePreviewTab(idx)}
                          className={`text-left px-3 py-2 rounded text-xs transition-all font-semibold ${
                            activePreviewTab === idx
                              ? "bg-red-50 text-red-700 shadow-sm border border-red-100"
                              : "hover:bg-slate-50 text-gray-600"
                          }`}
                        >
                          <div className="font-sans font-bold text-gray-800">
                            Page {page.pageNum}
                          </div>
                          <div className="text-[9px] text-gray-400 font-normal truncate mt-0.5">
                            {page.title}
                          </div>
                        </button>
                      ))}

                      <div className="mt-auto p-3 bg-red-50/40 rounded border border-red-100 text-[9px] space-y-1">
                        <span className="font-bold text-red-800 block">
                          PDF Decryption Mode
                        </span>
                        <p className="text-gray-500 leading-normal">
                          Pre-rendered for high security inside the sandbox.
                          Direct modification restricted.
                        </p>
                      </div>
                    </div>

                    {/* Main PDF Canvas area */}
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
                      {/* Document Header Controls */}
                      <div className="max-w-xl w-full bg-slate-800 text-white rounded-t-lg px-4 py-1.5 flex items-center justify-between text-xs font-mono shrink-0 select-none shadow-sm">
                        <div className="flex items-center gap-1 text-gray-400">
                          <span>Zoom:</span>
                          <span className="text-white font-bold">100%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            disabled={activePreviewTab === 0}
                            onClick={() =>
                              setActivePreviewTab((prev) =>
                                Math.max(0, prev - 1),
                              )
                            }
                            className="px-1.5 py-0.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-bold"
                          >
                            &lt; Prev
                          </button>
                          <span>
                            {activePreviewTab + 1} / {pdfPages.length}
                          </span>
                          <button
                            disabled={activePreviewTab === pdfPages.length - 1}
                            onClick={() =>
                              setActivePreviewTab((prev) =>
                                Math.min(pdfPages.length - 1, prev + 1),
                              )
                            }
                            className="px-1.5 py-0.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-bold"
                          >
                            Next &gt;
                          </button>
                        </div>
                      </div>

                      {/* PDF Page Canvas */}
                      <div className="max-w-xl w-full bg-white shadow-lg border border-gray-300 rounded-b-lg p-10 font-sans min-h-125 flex flex-col justify-between">
                        <div className="space-y-6">
                          {/* Page header indicator */}
                          <div className="flex justify-between items-center text-[8px] text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
                            <span>{previewAttachmentName}</span>
                            <span>
                              Page {pdfPages[activePreviewTab]?.pageNum} of{" "}
                              {pdfPages.length}
                            </span>
                          </div>

                          {/* Page body */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-800 border-l-2 border-red-600 pl-2">
                              {pdfPages[activePreviewTab]?.title}
                            </h4>
                            <div className="text-[11px] text-gray-600 leading-relaxed font-sans space-y-3 whitespace-pre-line">
                              {pdfPages[activePreviewTab]?.content.map(
                                (textLine, tlIdx) => (
                                  <p
                                    key={tlIdx}
                                    className={
                                      textLine.includes("---")
                                        ? "border-t border-dashed border-gray-100 pt-3"
                                        : ""
                                    }
                                  >
                                    {textLine}
                                  </p>
                                ),
                              )}
                            </div>
                          </div>
                        </div>

                        {/* PDF Footer seal */}
                        <div className="pt-8 border-t border-gray-100 flex justify-between items-center text-[8px] text-gray-400">
                          <span>PRS SECURE PLATFORM • PDF READER v1.4</span>
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                            SHA-256 SECURED
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-t border-[#c4c5d7] flex justify-between items-center shrink-0">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encrypted Sandbox View • No local footprint stored</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewRequest(null)}
                  className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold py-1.5 px-4 rounded transition-all cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  onClick={(e) => {
                    setPreviewRequest(null);
                    handleDownload(e, previewRequest);
                  }}
                  className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-bold py-1.5 px-4 rounded transition-all cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Original Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
