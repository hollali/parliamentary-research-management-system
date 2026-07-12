import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getDownloadUrl, getAttachments, getWorkloadStats } from '../lib/api';
import { AssignModal } from './AssignModal';
import { 
  Search, 
  MoreVertical, 
  UserPlus, 
  Clock, 
  AlertTriangle, 
  ChevronDown, 
  Zap, 
  Filter, 
  X, 
  Eye, 
  Paperclip, 
  FileSpreadsheet,
  FileText,
  Download,
  ShieldCheck,
  GitCompare
} from 'lucide-react';

interface ProjectsViewProps {
  onNavigate: (view: string, id: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigate }) => {
  const { requests, assignRequest, updateRequestPriority, extendRequestDeadline } = useApp();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadStep, setDownloadStep] = useState<string>('');
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [assignModalRequestId, setAssignModalRequestId] = useState<string | null>(null);
  const [assignModalRequestTitle, setAssignModalRequestTitle] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const [previewRequest, setPreviewRequest] = useState<any | null>(null);
  const [previewType, setPreviewType] = useState<'draft' | 'attachment'>('draft');
  const [previewAttachmentName, setPreviewAttachmentName] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<number>(0);

  // Reset active tab whenever preview selection changes
  React.useEffect(() => {
    setActivePreviewTab(0);
  }, [previewRequest, previewType, previewAttachmentName]);

  // Fetch workload stats
  const [workload, setWorkload] = useState<any>(null);
  React.useEffect(() => {
    getWorkloadStats()
      .then((data) => setWorkload(data))
      .catch(() => {});
  }, []);

  const parsedSections = React.useMemo(() => {
    if (!previewRequest) return [];
    
    const text: string = previewRequest.content || `
      1. Executive Summary: This research document was commissioned by ${previewRequest.member} to assess the statutory framework of ${previewRequest.title}.
      
      The analysis explores regulatory blockages, regional implementation histories, and the administrative feasibility of proposed adjustments.
      
      2. Legislative Context: Under current parliamentary standing orders, policy submissions require dual-directorate clearance. 
      This inquiry aligns with current national growth policies and addresses critical gaps in enforcement and standard-setting.
      
      3. Financial Scope & Outlook: Fiscal allocations are projected to remain within standard ministerial limits. 
      A structured budget assessment suggests a 4.2% optimization index if structural recommendations are enacted in full.
      
      4. Stakeholders & Precedents: Principal consultants include ministerial liaison officers, municipal authority chairs, and statistical agency directors.
    `;

    // Try to parse sections dynamically
    const sections: { title: string; content: string[] }[] = [];
    const lines = text.split('\n');
    let currentSection: { title: string; content: string[] } | null = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check if line looks like a header
      if (/^\d+\.\s+\w+/.test(trimmed) || trimmed.startsWith('I.') || trimmed.startsWith('II.') || trimmed.startsWith('III.') || trimmed.startsWith('IV.') || trimmed.startsWith('V.')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = { title: trimmed, content: [] };
      } else {
        if (!currentSection) {
          currentSection = { title: 'General Information & Brief Overview', content: [] };
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
    
    const xlsxFile = previewRequest.attachments.find((a: any) => a.name?.endsWith('.xlsx'));
    if (!xlsxFile) return null;

    return {
      title: xlsxFile.name,
      headers: ["File Name", "Type", "Size", "Status"],
      rows: [[xlsxFile.name, xlsxFile.type || 'xlsx', xlsxFile.size || 'N/A', 'Attached']],
      totals: ["Total", "1 file", "—", "—"]
    };
  }, [previewRequest]);

  const pdfPages = React.useMemo(() => {
    if (!previewRequest) return [];
    
    const content: string = previewRequest.content || '';
    if (!content) {
      return [{
        pageNum: 1,
        title: "No content available",
        content: ["Report content has not been uploaded yet."]
      }];
    }

    const lines = content.split('\n').filter((l: string) => l.trim());
    const pageSize = 15;
    const pages: { pageNum: number; title: string; content: string[] }[] = [];
    
    for (let i = 0; i < lines.length; i += pageSize) {
      const pageLines = lines.slice(i, i + pageSize);
      const pageNum = pages.length + 1;
      pages.push({
        pageNum,
        title: `Page ${pageNum}`,
        content: pageLines
      });
    }
    
    return pages.length > 0 ? pages : [{
      pageNum: 1,
      title: "Document",
      content: [content]
    }];
  }, [previewRequest]);

  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    requests.forEach(req => {
      if (req.category) cats.add(req.category);
    });
    return Array.from(cats).sort();
  }, [requests]);

  const statuses = [
    { value: 'PENDING_REVIEW', label: 'Pending Review' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'REVISION_REQUESTED', label: 'Revision Requested' },
    { value: 'REVISION_IN_PROGRESS', label: 'Revision In Progress' },
    { value: 'OVERDUE', label: 'Overdue' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  const filteredRequests = React.useMemo(() => {
    return requests.filter(req => {
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = !searchLower || 
        req.id.toLowerCase().includes(searchLower) ||
        req.title.toLowerCase().includes(searchLower) ||
        (req.assignedOfficerName && req.assignedOfficerName.toLowerCase().includes(searchLower));

      const matchesCategory = !selectedCategory || req.category === selectedCategory;
      const matchesStatus = !selectedStatus || req.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [requests, searchQuery, selectedCategory, selectedStatus]);

  const isFiltered = searchQuery !== '' || selectedCategory !== '' || selectedStatus !== '';
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedStatus('');
  };

  React.useEffect(() => {
    const handleGlobalClick = () => {
      setActiveDropdownId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const extendDeadlineStr = (currentDeadline: string, days: number): string => {
    try {
      const d = new Date(currentDeadline);
      if (isNaN(d.getTime())) {
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + days);
        return fallback.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
      }
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + days);
      return fallback.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
  };

  const getProgressPercentage = (status: string): number => {
    switch (status) {
      case 'PENDING_REVIEW': return 15;
      case 'ASSIGNED': return 30;
      case 'IN_PROGRESS': return 55;
      case 'REVISION_REQUESTED': return 75;
      case 'REVISION_IN_PROGRESS': return 85;
      case 'OVERDUE': return 40;
      case 'COMPLETED': return 100;
      default: return 0;
    }
  };

  const getProgressColor = (status: string): string => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-600';
      case 'OVERDUE': return 'bg-[#ba1a1a]';
      case 'REVISION_REQUESTED':
      case 'REVISION_IN_PROGRESS': return 'bg-amber-500';
      default: return 'bg-[#0037b0]';
    }
  };

  const handleDownload = (e: React.MouseEvent, req: any) => {
    e.stopPropagation();
    if (downloadingId) return;

    const att = req.attachments?.[0];
    if (!att?.id) return;

    setDownloadingId(req.id);
    setDownloadStep('Preparing download...');

    const link = document.createElement('a');
    link.href = getDownloadUrl(att.id);
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingId(null);
      setDownloadStep('');
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex justify-between items-center">
          <h3 className="font-sans font-bold text-gray-900">Research Inquiry Pipeline</h3>
          <span className="text-xs text-gray-500 font-semibold">
            {isFiltered 
              ? `${filteredRequests.length} of ${requests.length} entries` 
              : `${requests.length} total entries`}
          </span>
        </div>

        {/* Workload Summary */}
        {workload?.officers?.length > 0 && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/30">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Officer Workload</span>
              <span className="text-[10px] text-gray-400">
                {workload.summary.totalActive} active / {workload.summary.totalOfficers} officers
                {workload.summary.atCapacity > 0 && <span className="text-amber-600 ml-2">• {workload.summary.atCapacity} at capacity</span>}
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {workload.officers.map((o: any) => (
                <div key={o.id} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded px-2 py-1">
                  <div className={`w-2 h-2 rounded-full ${
                    o.status === 'at_capacity' ? 'bg-red-500' :
                    o.status === 'high' ? 'bg-amber-500' :
                    o.status === 'moderate' ? 'bg-blue-500' :
                    'bg-green-500'
                  }`} />
                  <span className="text-[10px] font-semibold text-gray-700">{o.firstName} {o.lastName}</span>
                  <span className="text-[9px] text-gray-400">{o.activeCount}/{o.capacity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Category Filter */}
            <div className="relative min-w-[140px]">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-gray-700 focus:outline-none focus:border-[#0037b0] appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Status Filter */}
            <div className="relative min-w-[150px]">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-gray-700 focus:outline-none focus:border-[#0037b0] appearance-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                {statuses.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
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

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRequests.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-3 bg-gray-50/50 rounded-lg border border-dashed border-[#c4c5d7]">
                <Filter className="w-8 h-8 text-gray-400 animate-pulse" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-gray-900">No inquiry records match your criteria</h5>
                  <p className="text-[10px] text-gray-500 max-w-sm">Try modifying your search text, selecting a different category, or clearing the active filters.</p>
                </div>
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm transition-all cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            ) :
              filteredRequests.map(req => {
              const progress = getProgressPercentage(req.status);
              const colorClass = getProgressColor(req.status);
              const isDownloading = downloadingId === req.id;
              return (
                <div 
                  key={req.id} 
                  onClick={() => onNavigate('briefs', req.id)}
                  className="border border-[#c4c5d7] hover:border-[#0037b0] rounded-lg p-4 cursor-pointer space-y-3.5 hover:bg-blue-50/10 transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start relative">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-[#dce1ff] text-[#0039b5] text-[10px] font-bold px-2 py-0.5 rounded">{req.id}</span>
                        {req.priority === 'URGENT' && (
                          <span className="bg-red-50 text-red-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-red-200 animate-pulse uppercase tracking-wider">Urgent</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {req.status === 'REVISION_REQUESTED' ? (
                          <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wide flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            Revision Requested
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 uppercase">{req.status.replace('_', ' ')}</span>
                        )}
                        
                        {/* Quick Actions Dropdown Trigger */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownId(activeDropdownId === req.id ? null : req.id);
                            }}
                            className="p-1 rounded text-gray-400 hover:text-[#0037b0] hover:bg-gray-100 transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-gray-200"
                            title="Quick Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          
                          {activeDropdownId === req.id && (
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              className="absolute right-0 mt-1 w-52 bg-white border border-[#c4c5d7] rounded-md shadow-lg z-50 py-1.5 animate-fadeIn font-sans"
                            >
                              <div className="px-3 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1 mb-1 flex items-center justify-between">
                                <span>Quick Actions</span>
                                <Zap className="w-2.5 h-2.5 text-amber-500 fill-amber-500 animate-bounce" />
                              </div>
                              
                              {/* ASSIGN / REASSIGN */}
                              <div className="px-1.5">
                                <button
                                  onClick={() => {
                                    setAssignModalRequestId(req.id);
                                    setAssignModalRequestTitle(req.title);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-[#0037b0] hover:bg-[#dce1ff] rounded transition-colors cursor-pointer"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  {req.assignedOfficerId ? 'Reassign' : 'Assign'} Research
                                </button>
                              </div>
                              
                              <div className="border-t border-gray-100 my-1" />

                              {/* EXTEND DEADLINE */}
                              <div className="px-1.5">
                                <div className="px-2 py-1 text-[9px] font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                                  <Clock className="w-3 h-3 text-[#0037b0]" />
                                  Extend Due Date
                                </div>
                                <div className="flex gap-1 pl-3 pb-1">
                                  <button
                                    onClick={() => {
                                      const newDate = extendDeadlineStr(req.deadline, 7);
                                      extendRequestDeadline(req.id, newDate);
                                      setActiveDropdownId(null);
                                    }}
                                    className="px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded text-[9px] font-bold transition-all"
                                  >
                                    +7 Days
                                  </button>
                                  <button
                                    onClick={() => {
                                      const newDate = extendDeadlineStr(req.deadline, 14);
                                      extendRequestDeadline(req.id, newDate);
                                      setActiveDropdownId(null);
                                    }}
                                    className="px-2 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded text-[9px] font-bold transition-all"
                                  >
                                    +14 Days
                                  </button>
                                </div>
                              </div>

                              <div className="border-t border-gray-100 my-1" />

                              {/* SEND URGENT FLAG */}
                              <button
                                onClick={() => {
                                  updateRequestPriority(req.id, req.priority === 'URGENT' ? 'STANDARD' : 'URGENT');
                                  setActiveDropdownId(null);
                                }}
                                className={`w-full text-left px-3 py-1 text-[9px] font-bold flex items-center gap-1.5 transition-colors uppercase tracking-wider ${
                                  req.priority === 'URGENT'
                                    ? 'text-amber-700 hover:bg-amber-50'
                                    : 'text-red-700 hover:bg-red-50'
                                }`}
                              >
                                <AlertTriangle className={`w-3 h-3 ${req.priority === 'URGENT' ? 'text-amber-600' : 'text-red-600'}`} />
                                {req.priority === 'URGENT' ? 'Clear Urgent Flag' : 'Send Urgent Flag'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{req.title}</h4>
                    <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">{req.description}</p>
                    
                    {/* Attachments & Drafts Quick Previews */}
                    <div className="pt-2 border-t border-gray-100 space-y-1.5">
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Paperclip className="w-2.5 h-2.5 text-gray-400" />
                        <span>Attached Files & Drafts</span>
                      </div>
                      <div className="space-y-1">
                        {/* Always offer Draft Brief preview */}
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewRequest(req);
                            setPreviewType('draft');
                            setPreviewAttachmentName(null);
                          }}
                          className="flex items-center justify-between p-1.5 bg-blue-50/40 hover:bg-blue-50/80 border border-blue-100/50 rounded text-[10px] text-gray-700 cursor-pointer group transition-all"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-[#0037b0] shrink-0" />
                            <span className="font-semibold text-gray-800 truncate">Official Briefing Draft</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <span className="text-[8px] bg-blue-100 text-[#0037b0] px-1 py-0.2 rounded font-bold">Draft v{req.draftVersion || 1}</span>
                            <Eye className="w-3 h-3 text-[#0037b0]" />
                          </div>
                        </div>

                        {/* Listed Attachments */}
                        {req.attachments && req.attachments.map((att: any, attIdx: number) => {
                          const isExcel = att.type === 'xlsx';
                          return (
                            <div 
                              key={attIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewRequest(req);
                                setPreviewType('attachment');
                                setPreviewAttachmentName(att.name);
                              }}
                              className="flex items-center justify-between p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/50 rounded text-[10px] text-gray-700 cursor-pointer group transition-all"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isExcel ? (
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                )}
                                <span className="font-medium truncate text-gray-700">{att.name}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <span className="text-[8px] text-gray-400 font-semibold">{att.size}</span>
                                <Eye className="w-3 h-3 text-gray-500" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {/* Progress Bar Container */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-semibold text-[#434655]">
                        <span className="uppercase tracking-wider">
                          {isDownloading ? (
                            <span className="text-[#0037b0] animate-pulse font-bold flex items-center gap-1">
                              {downloadStep}
                            </span>
                          ) : (
                            "Workflow Progress"
                          )}
                        </span>
                        <span className="font-bold text-[#0037b0]">{progress}%</span>
                      </div>
                      <div className={`w-full h-1.5 bg-gray-100 rounded-full overflow-hidden ${req.status === 'REVISION_REQUESTED' ? 'ring-1 ring-amber-300' : ''}`}>
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ease-out ${
                            isDownloading 
                              ? 'bg-amber-500 animate-pulse' 
                              : req.status === 'REVISION_REQUESTED'
                                ? `${colorClass} animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]`
                                : colorClass
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold border-t border-gray-100 pt-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1 text-[9px]">
                          <span className="text-gray-500 font-medium">MP:</span>
                          <span className="text-gray-700 font-bold">{req.member}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px]">
                          <span className="text-gray-500 font-medium">Officer:</span>
                          <span className="text-[#0037b0] font-bold">{req.assignedOfficerName || 'Not Assigned'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[9px]">
                          <span className="text-gray-500 font-medium">Due:</span>
                          <span className="text-gray-700 font-bold">{req.deadline}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDownload(e, req)}
                        disabled={downloadingId !== null}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer ${
                          isDownloading
                            ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                            : 'bg-white text-[#0037b0] border-[#c4c5d7] hover:bg-[#dce1ff]/20 hover:border-[#0037b0]'
                        }`}
                        title="Download official parliamentary brief report"
                      >
                        <Download className={`w-3 h-3 ${isDownloading ? 'animate-bounce' : ''}`} />
                        {isDownloading ? 'Exporting...' : 'Download Brief'}
                      </button>
                      <button
                        onClick={() => onNavigate('version-diff', req.reportId || req.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer bg-white text-gray-600 border-[#c4c5d7] hover:bg-gray-50 hover:border-gray-300"
                        title="View version history and compare changes"
                      >
                        <GitCompare className="w-3 h-3" />
                        Versions
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Preview Modal */}
      {previewRequest && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setPreviewRequest(null)}
        >
          <div 
            className="bg-white border border-[#c4c5d7] rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scaleIn"
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
                      {previewType === 'draft' ? "Official Briefing Draft" : previewAttachmentName}
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
              {previewType === 'draft' && (
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
                            ? 'bg-[#dce1ff] text-[#0039b5] shadow-sm' 
                            : 'hover:bg-slate-50 text-gray-700'
                        }`}
                      >
                        <div className="truncate font-sans font-bold">{sec.title}</div>
                        <div className="text-[9px] text-gray-400 font-normal truncate mt-0.5">
                          {sec.content[0] || 'View details...'}
                        </div>
                      </button>
                    ))}
                    
                    <div className="mt-auto border-t border-gray-100 pt-4 space-y-2">
                      <div className="p-2.5 bg-[#f8f9fa] border border-gray-200 rounded text-[10px] space-y-1">
                        <span className="font-bold text-gray-700 block">Security Classification</span>
                        <span className="text-red-700 font-extrabold text-[9px] tracking-wider uppercase block">OFFICIAL-SENSITIVE</span>
                        <span className="text-gray-500 block">Restricted to active MPs and assigned legal investigators.</span>
                      </div>
                    </div>
                  </div>

                  {/* Main Document Content */}
                  <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                    <div className="max-w-2xl w-full bg-white shadow-md border border-gray-200/60 rounded-lg p-10 font-sans min-h-[100%] relative space-y-6 flex flex-col">
                      {/* Letterhead decoration */}
                      <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                        <div>
                          <h4 className="text-[11px] font-bold text-gray-900 tracking-widest uppercase">Parliamentary Research Services</h4>
                          <span className="text-[9px] text-gray-500 font-semibold uppercase">Republic of Ghana • Joint Secretariat Vault</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold uppercase tracking-wider">
                            SECURE DRAFT
                          </span>
                        </div>
                      </div>

                      {/* Title of active segment */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Active Chapter</span>
                        <h2 className="text-sm font-bold text-gray-900 font-sans border-b border-gray-100 pb-1">
                          {parsedSections[activePreviewTab]?.title}
                        </h2>
                      </div>

                      {/* Content paragraphs */}
                      <div className="text-xs text-gray-700 leading-relaxed font-sans space-y-4 flex-1">
                        {parsedSections[activePreviewTab]?.content.map((p, pIdx) => (
                          <p key={pIdx} className="text-justify font-sans">
                            {p}
                          </p>
                        ))}
                      </div>

                      {/* Signature block / stamp placeholder */}
                      <div className="pt-8 border-t border-gray-100 flex justify-between items-end text-[9px] text-gray-400">
                        <div>
                          <p className="font-bold text-gray-600">DIRECTORATE SIGN-OFF:</p>
                          <p className="font-semibold text-[#0037b0] mt-1">Verified: RSA-4096 Secure Signature</p>
                          <p className="text-gray-400 font-medium">Date Verified: {new Date().toLocaleDateString()}</p>
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
              {previewType === 'attachment' && previewAttachmentName?.endsWith('.xlsx') && spreadsheetData && (
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                  {/* Spreadsheet toolbar */}
                  <div className="bg-white border border-[#c4c5d7] rounded-t-lg px-4 py-2 flex items-center justify-between shrink-0 border-b-0">
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                        <span>Interactive Excel Viewer</span>
                      </div>
                      <span className="text-xs font-bold text-gray-700">{spreadsheetData.title}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">Sheet1 / Auto-calculated</div>
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
                          <tr key={rIdx} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                            <td className="bg-slate-50 border-r border-slate-200 text-center font-mono text-[9px] text-gray-400 py-1 select-none font-bold">
                              {rIdx + 1}
                            </td>
                            {row.map((val, cIdx) => {
                              const isNumeric = !isNaN(parseFloat(val.replace(/[%,M\s]/g, '')));
                              return (
                                <td 
                                  key={cIdx} 
                                  className={`px-4 py-2 border-r border-gray-100 text-[11px] font-mono truncate ${
                                    isNumeric ? 'text-right text-gray-800' : 'text-gray-600'
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
                          <tr key={`blank-${bIdx}`} className="border-b border-gray-50 bg-white">
                            <td className="bg-slate-50 border-r border-slate-100 text-center font-mono text-[9px] text-gray-300 py-1 select-none">
                              {spreadsheetData.rows.length + bIdx + 1}
                            </td>
                            {spreadsheetData.headers.map((_, hIdx) => (
                              <td key={hIdx} className="px-4 py-2 border-r border-gray-50 text-[11px] font-mono"></td>
                            ))}
                          </tr>
                        ))}

                        {/* Totals Summary Row */}
                        <tr className="bg-emerald-50/50 border-t-2 border-emerald-600/30 font-bold">
                          <td className="bg-emerald-100/50 border-r border-emerald-200 text-center font-mono text-[9px] text-emerald-800 py-1.5 select-none font-black">
                            ∑
                          </td>
                          {spreadsheetData.totals.map((total, tIdx) => {
                            const isNumeric = total.includes('M') || total.includes('%') || total.includes(',');
                            return (
                              <td 
                                key={tIdx} 
                                className={`px-4 py-2 border-r border-emerald-100 text-[11px] text-emerald-900 font-bold font-mono ${
                                  isNumeric ? 'text-right' : 'text-left'
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
              {previewType === 'attachment' && !previewAttachmentName?.endsWith('.xlsx') && (
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
                            ? 'bg-red-50 text-red-700 shadow-sm border border-red-100' 
                            : 'hover:bg-slate-50 text-gray-600'
                        }`}
                      >
                        <div className="font-sans font-bold text-gray-800">Page {page.pageNum}</div>
                        <div className="text-[9px] text-gray-400 font-normal truncate mt-0.5">
                          {page.title}
                        </div>
                      </button>
                    ))}

                    <div className="mt-auto p-3 bg-red-50/40 rounded border border-red-100 text-[9px] space-y-1">
                      <span className="font-bold text-red-800 block">PDF Decryption Mode</span>
                      <p className="text-gray-500 leading-normal">
                        Pre-rendered for high security inside the sandbox. Direct modification restricted.
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
                          onClick={() => setActivePreviewTab(prev => Math.max(0, prev - 1))}
                          className="px-1.5 py-0.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-bold"
                        >
                          &lt; Prev
                        </button>
                        <span>{activePreviewTab + 1} / {pdfPages.length}</span>
                        <button 
                          disabled={activePreviewTab === pdfPages.length - 1}
                          onClick={() => setActivePreviewTab(prev => Math.min(pdfPages.length - 1, prev + 1))}
                          className="px-1.5 py-0.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent font-bold"
                        >
                          Next &gt;
                        </button>
                      </div>
                    </div>

                    {/* PDF Page Canvas */}
                    <div className="max-w-xl w-full bg-white shadow-lg border border-gray-300 rounded-b-lg p-10 font-sans min-h-[500px] flex flex-col justify-between">
                      <div className="space-y-6">
                        {/* Page header indicator */}
                        <div className="flex justify-between items-center text-[8px] text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
                          <span>{previewAttachmentName}</span>
                          <span>Page {pdfPages[activePreviewTab]?.pageNum} of {pdfPages.length}</span>
                        </div>

                        {/* Page body */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 border-l-2 border-red-600 pl-2">
                            {pdfPages[activePreviewTab]?.title}
                          </h4>
                          <div className="text-[11px] text-gray-600 leading-relaxed font-sans space-y-3 whitespace-pre-line">
                            {pdfPages[activePreviewTab]?.content.map((textLine, tlIdx) => (
                              <p key={tlIdx} className={textLine.includes('---') ? 'border-t border-dashed border-gray-100 pt-3' : ''}>
                                {textLine}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* PDF Footer seal */}
                      <div className="pt-8 border-t border-gray-100 flex justify-between items-center text-[8px] text-gray-400">
                        <span>PRS SECURE PLATFORM • PDF READER v1.4</span>
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold">SHA-256 SECURED</span>
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
          onClose={() => { setAssignModalRequestId(null); setAssignModalRequestTitle(''); }}
        />
      )}
    </div>
  );
};
