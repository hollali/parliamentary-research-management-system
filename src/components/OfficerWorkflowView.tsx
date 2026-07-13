import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { acceptAssignment, declineAssignment, uploadFile, getToken } from '../lib/api';
import { ResearchRequest } from '../types';
import { 
  Inbox, 
  Clock, 
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
  XCircle
} from 'lucide-react';

interface OfficerWorkflowViewProps {
  onNavigate: (view: string, targetId?: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const OfficerWorkflowView: React.FC<OfficerWorkflowViewProps> = ({ onNavigate }) => {
  const { requests, updateRequestStatus } = useApp();
  const { toast } = useToast();
  
  // Officer's assigned requests
  const officerRequests = requests.filter(r => r.assignedOfficerId !== null);
  
  const [selectedId, setSelectedId] = useState<string>(
    officerRequests[0]?.id || requests[0]?.id || ''
  );

  const activeRequest = requests.find(r => r.id === selectedId) || requests[0];

  const handleStatusChange = (status: ResearchRequest['status']) => {
    updateRequestStatus(activeRequest.id, status);
  };

  const handleAccept = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/assignments/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const assignments = Array.isArray(data) ? data : (data?.requests || []);
      const myAssignment = Array.isArray(assignments) ? assignments.find((a: any) => a.id && a.requestId === activeRequest.id) : null;
      if (myAssignment) {
        await acceptAssignment(myAssignment.id);
        toast.success('Assignment accepted');
        handleStatusChange('IN_PROGRESS');
      } else {
        handleStatusChange('IN_PROGRESS');
        toast.success('Assignment accepted');
      }
    } catch {
      toast.error('Failed to accept assignment');
    }
  };

  const handleDecline = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/assignments/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const assignments = Array.isArray(data) ? data : (data?.requests || []);
      const myAssignment = Array.isArray(assignments) ? assignments.find((a: any) => a.id && a.requestId === activeRequest.id) : null;
      if (myAssignment) {
        await declineAssignment(myAssignment.id);
        toast.success('Assignment declined');
        setSelectedId(officerRequests.filter(r => r.id !== activeRequest.id)[0]?.id || '');
      } else {
        toast.info('Assignment not found or already processed');
      }
    } catch {
      toast.error('Failed to decline assignment');
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
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* View Header */}
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Officer Workspace & Daily Assignments</h2>
        <p className="font-sans text-sm text-[#434655] mt-1">Manage assigned inquiries, review feedback, and upload final briefings.</p>
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

          <div className="divide-y divide-gray-100 flex-1 overflow-y-auto max-h-[500px]">
            {officerRequests.map(req => {
              const isSelected = req.id === selectedId;
              return (
                <div 
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                  className={`p-4 cursor-pointer transition-colors relative text-left hover:bg-gray-50/50 ${
                    isSelected ? 'bg-blue-50/30' : ''
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-[#0037b0]" />
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-gray-400">{req.id}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      req.priority === 'URGENT' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#edeeef] text-gray-600'
                    }`}>
                      {req.priority}
                    </span>
                  </div>
                  <h5 className="font-semibold text-xs text-gray-900 mt-1 truncate max-w-[200px]">
                    {req.title}
                  </h5>
                  <p className="text-[10px] text-gray-500 truncate">{req.category}</p>

                  <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-gray-100 text-[10px] text-gray-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {req.deadline}
                    </span>
                    <span className="uppercase text-[#0037b0]">{req.status.replace('_', ' ')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Columns: Active Assignment details & draft zone */}
        {activeRequest && (
          <div className="lg:col-span-2 space-y-6">
            
            {/* Detailed details board */}
            <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm space-y-6">
              <header className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="bg-[#dce1ff] text-[#0039b5] font-bold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                    {activeRequest.id}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">{activeRequest.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Requested by: <span className="font-bold text-gray-700">{activeRequest.member}</span>
                  </p>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-2">
                  {activeRequest.status === 'ASSIGNED' ? (
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
                      <span className="text-xs text-gray-500 font-semibold">Active Status:</span>
                      <select 
                        value={activeRequest.status}
                        onChange={(e) => handleStatusChange(e.target.value as ResearchRequest['status'])}
                        className="text-xs font-bold bg-[#f3f4f5] border border-[#c4c5d7] p-2 rounded-lg outline-none focus:ring-1 focus:ring-[#0037b0] text-gray-800"
                      >
                        <option value="ASSIGNED">Assigned</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </>
                  )}
                </div>
              </header>

              {/* Inquiry Description */}
              <div className="space-y-1.5">
                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-gray-400" /> Inquiry Scope Description
                </h5>
                <p className="text-xs text-gray-700 leading-relaxed bg-[#f3f4f5]/50 p-4 rounded-lg">
                  {activeRequest.description}
                </p>
              </div>

              {/* Key Stakeholders & Data references */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Key Stakeholders
                  </h6>
                  <p className="text-xs text-[#434655] font-semibold">{activeRequest.keyStakeholders || 'Ministry representatives, local municipal coordinators.'}</p>
                </div>
                <div className="space-y-1">
                  <h6 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-gray-400" /> Authorized Data Sources
                  </h6>
                  <p className="text-xs text-[#434655] font-semibold">{activeRequest.dataSources || 'National Bureau of Statistics, Geo-spatial regional metrics.'}</p>
                </div>
              </div>

              {/* Revision Editor shortcut trigger button */}
              <div className="bg-[#dce1ff]/30 border border-[#0037b5]/20 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-[#0039b5] flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" /> Document Draft Workspace
                  </p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Write and format your research brief draft directly inside the secure editor.</p>
                </div>
                <button 
                  onClick={() => onNavigate('workspace', activeRequest.id)}
                  className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-1 shadow-sm transition-all"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Open Editor</span>
                </button>
              </div>

              {/* Draft Upload Zone */}
              <div className="space-y-3.5 border-t border-gray-100 pt-5">
                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-gray-400" /> Briefing Attachment Slots
                </h5>
                
                {/* Upload dash area */}
                <div 
                  onDragOver={handleDragOver}
                  onDrop={handleDropDraft}
                  onClick={() => document.getElementById('officer-brief-file')?.click()}
                  className="border-2 border-dashed border-[#c4c5d7] hover:border-[#0037b0] bg-gray-50/50 hover:bg-gray-100/50 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                >
                  <input 
                    id="officer-brief-file"
                    type="file" 
                    accept=".pdf,.docx,.xlsx,.zip"
                    multiple
                    onChange={handleFileInput}
                    className="hidden" 
                  />
                  <Upload className="w-5 h-5 text-gray-400" />
                  <p className="text-xs font-bold text-gray-900">Drag & drop files here to attach</p>
                  <p className="text-[9px] text-gray-500">Supports PDF, DOCX, XLSX, ZIP up to 50MB. Files are verified for active security compliance.</p>
                </div>

                {/* Attached files rows */}
                {activeRequest.attachments.length > 0 && (
                  <div className="space-y-2.5">
                    {activeRequest.attachments.map((file, idx) => (
                      <div key={idx} className="bg-white border border-[#c4c5d7] rounded-lg p-2.5 flex justify-between items-center text-xs shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4.5 h-4.5 text-red-500" />
                          <span className="font-semibold text-gray-900">{file.name}</span>
                        </div>
                        <span className="text-gray-500 font-bold">{file.size}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Admin reviews feedback board summary */}
              {activeRequest.comments.length > 0 && (
                <div className="space-y-3 border-t border-gray-100 pt-5">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Review Comments & Feedbacks</h5>
                  <div className="space-y-3">
                    {activeRequest.comments.map(c => (
                      <div key={c.id} className="p-3 bg-amber-50/40 rounded border border-amber-200 text-xs">
                        <div className="flex justify-between font-bold text-gray-900 mb-1">
                          <span>{c.userName} ({c.role})</span>
                          <span className="text-[10px] text-gray-400">{c.time}</span>
                        </div>
                        <p className="text-gray-600 leading-normal italic">"{c.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
