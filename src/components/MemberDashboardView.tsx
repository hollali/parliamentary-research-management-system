import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { getDownloadUrl, uploadFile } from '../lib/api';
import { honourable } from '../lib/format';
import { ResearchRequest } from '../types';
import { 
  BarChart3, 
  Sparkles, 
  Clock, 
  Award, 
  FileCheck, 
  Download, 
  ChevronRight, 
  Send,
  Upload
} from 'lucide-react';

export const MemberDashboardView: React.FC = () => {
  const { requests, currentUser, addComment, updateRequestPriority } = useApp();
  const { toast } = useToast();
  const memberRequests = requests.filter(r => r.member === currentUser.name);
  
  // Default to first request if available
  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    memberRequests[0]?.id || requests[0]?.id || ''
  );
  
  const [feedbackText, setFeedbackText] = useState('');
  const [isExpedited, setIsExpedited] = useState(false);

  const activeRequest = requests.find(r => r.id === selectedRequestId) || requests[0];

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !activeRequest) return;
    addComment(activeRequest.id, feedbackText);
    setFeedbackText('');
    toast.success('Your feedback has been appended to the request timeline.');
  };

  const getStatusLabel = (status: ResearchRequest['status']) => {
    switch (status) {
      case 'SUBMITTED': return 'Under Review';
      case 'ASSIGNED': return 'Assigned';
      case 'IN_PROGRESS': return 'In Progress';
      case 'REVISION_REQUESTED':
      case 'REVISED': return 'Under Revision';
      case 'APPROVED': return 'Completed';
      case 'OVERDUE': return 'Overdue';
      default: return status;
    }
  };

  // Timeline step generator based on status
  const getTimelineSteps = (req: ResearchRequest) => {
    const isSubmitted = true;
    const isAssigned = ['ASSIGNED', 'IN_PROGRESS', 'REVISION_REQUESTED', 'REVISED', 'APPROVED'].includes(req.status);
    const isInProgress = ['IN_PROGRESS', 'REVISION_REQUESTED', 'REVISED', 'APPROVED'].includes(req.status);
    const isRevision = ['REVISION_REQUESTED', 'REVISED'].includes(req.status);
    const isCompleted = ['APPROVED', 'DELIVERED', 'CLOSED'].includes(req.status);

    return [
      {
        title: 'Request Submitted',
        date: req.dateSubmitted,
        desc: 'Request received and authenticated by administrative desk.',
        status: 'completed'
      },
      {
        title: 'Staff Appointed',
        date: isAssigned ? req.dateSubmitted : 'Awaiting Appointment',
        desc: isAssigned ? `Lead researcher ${req.assignedOfficerName || 'appointed'}.` : 'Selecting suitable research staff.',
        status: isAssigned ? 'completed' : 'pending'
      },
      {
        title: 'Draft Synthesis Active',
        date: isInProgress ? req.deadline : 'Awaiting Synthesis',
        desc: isInProgress ? 'Core research formulated and policy implications drafted.' : 'Research synthesis not started.',
        status: isCompleted ? 'completed' : isInProgress ? 'active' : 'pending'
      },
      {
        title: 'Administrative Peer Review',
        date: isCompleted ? req.deadline : isRevision ? 'Revision Required' : 'Awaiting submission',
        desc: isCompleted ? 'Final administrative check completed.' : isRevision ? 'Comments submitted for revision.' : 'Awaiting officer draft submission.',
        status: isCompleted ? 'completed' : isRevision ? 'active' : 'pending'
      },
      {
        title: 'Brief Delivered',
        date: isCompleted ? req.deadline : 'Awaiting Delivery',
        desc: isCompleted ? 'Secure brief transmitted to Member Office.' : 'Delivery upon final peer-review approval.',
        status: isCompleted ? 'completed' : 'pending'
      }
    ];
  };

  const steps = activeRequest ? getTimelineSteps(activeRequest) : [];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">
          Welcome back, {currentUser.role === 'MP' ? honourable(currentUser.name) : currentUser.name}
        </h2>
        <p className="font-sans text-sm text-[#434655] mt-1">
          Track legislative requests and access delivered research briefs.
        </p>
      </div>

      {/* Member Portal Metric Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Active Requests</p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">{memberRequests.filter(r => !['APPROVED', 'DELIVERED', 'CLOSED'].includes(r.status)).length}</h3>
            <p className="text-[11px] text-[#434655] mt-1">In progress</p>
          </div>
          <div className="p-3 bg-blue-50 text-[#0037b0] rounded">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Completed</p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">{memberRequests.filter(r => ['APPROVED', 'DELIVERED', 'CLOSED'].includes(r.status)).length}</h3>
            <p className="text-[11px] text-emerald-800 font-semibold mt-1">Delivered briefs</p>
          </div>
          <div className="p-3 bg-emerald-50 text-[#006b2c] rounded">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Total Requests</p>
            <h3 className="text-2xl font-bold text-[#191c1d] mt-1">{memberRequests.length}</h3>
            <p className="text-[11px] text-[#434655] mt-1">All time</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded">
            <FileCheck className="w-6 h-6" />
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
                Active Tracking: {activeRequest.id}
              </span>
              <h3 className="text-xl font-bold text-[#191c1d] mt-2 leading-snug">
                {activeRequest.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Category: <span className="font-semibold text-gray-700">{activeRequest.category}</span> • Topic: <span className="font-semibold text-gray-700">{activeRequest.topic}</span>
              </p>
            </header>

            {/* Vertical timeline steps */}
            <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {steps.map((step, idx) => {
                let dotClass = 'bg-gray-200 text-gray-400';
                let titleClass = 'text-gray-400 font-medium';
                if (step.status === 'completed') {
                  dotClass = 'bg-[#0037b0] text-white ring-4 ring-blue-50';
                  titleClass = 'text-gray-900 font-bold';
                } else if (step.status === 'active') {
                  dotClass = 'bg-yellow-500 text-white ring-4 ring-yellow-50 animate-pulse';
                  titleClass = 'text-yellow-800 font-bold';
                }

                return (
                  <div className="flex gap-6 relative z-10" key={idx}>
                    <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold ${dotClass}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className={`text-sm ${titleClass}`}>{step.title}</h4>
                        <span className="text-[11px] font-semibold text-gray-400">{step.date}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-normal">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right side: Sidebar files and updates */}
          <div className="p-8 bg-gray-50 flex flex-col justify-between">
            <div className="space-y-6">
              <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider">Delivered Attachments</h4>
              
              {activeRequest.attachments.length > 0 ? (
                <div className="space-y-3">
                  {activeRequest.attachments.map((file, fIdx) => (
                    <div key={fIdx} className="bg-white border border-[#c4c5d7] rounded-lg p-3 flex items-center justify-between shadow-sm hover:border-[#0037b0] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">PDF</div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{file.name}</p>
                          <p className="text-[10px] text-gray-500">{file.size}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (file.id) {
                            const link = document.createElement('a');
                            link.href = getDownloadUrl(file.id);
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } else {
                            toast.info('File not yet uploaded to server');
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

              {/* Document Upload Button */}
              <div className="mt-4">
                <input 
                  type="file" 
                  id="dashboard-file-upload"
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activeRequest) {
                      uploadFile(activeRequest.id, file)
                        .then(() => toast.success(`"${file.name}" uploaded successfully.`))
                        .catch(() => toast.error('Failed to upload file'));
                    }
                  }}
                />
                <button 
                  onClick={() => document.getElementById('dashboard-file-upload')?.click()}
                  className="w-full bg-white border border-dashed border-[#0037b0] text-[#0037b0] hover:bg-blue-50 text-xs font-semibold py-2 rounded flex items-center justify-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Additional Document</span>
                </button>
              </div>

              {/* Leave comments or feedback panel */}
              <form onSubmit={handleSendFeedback} className="space-y-3 border-t border-gray-200 pt-6">
                <h5 className="font-sans font-bold text-xs text-gray-700">Add Directive / Feedback</h5>
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

            {/* Expedited service action */}
            <div className="border-t border-gray-200 pt-6 mt-6 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-gray-900">Need immediate updates?</p>
                <p className="text-[10px] text-gray-500">Submit a priority review ticket</p>
              </div>
              <button 
                onClick={() => {
                  setIsExpedited(true);
                  if (activeRequest) {
                    updateRequestPriority(activeRequest.id, 'URGENT');
                  }
                  toast.success('Urgent review status triggered. Admin has been notified.');
                }}
                disabled={isExpedited}
                className={`text-xs font-semibold px-3 py-1.5 rounded transition-all ${
                  isExpedited ? 'bg-amber-100 text-amber-800 cursor-default' : 'bg-white border border-[#0037b0] text-[#0037b0] hover:bg-blue-50'
                }`}
              >
                {isExpedited ? 'Urgent Requested' : 'Request Rush'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Active Requests List Table */}
      <section className="bg-white border border-[#c4c5d7] rounded-lg overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[#c4c5d7] bg-[#f3f4f5]">
          <h4 className="font-sans font-semibold text-[#191c1d]">Your Active Requests</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f3f4f5]/30 border-b border-[#c4c5d7]">
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">Request ID</th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">Title</th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">Committee</th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">Researcher</th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">Status</th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase">Deadline</th>
                <th className="px-6 py-3 text-xs font-bold text-[#747686] uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {memberRequests.map(req => (
                <tr 
                  key={req.id} 
                  className={`cursor-pointer transition-colors hover:bg-[#f3f4f5]/30 ${
                    req.id === selectedRequestId ? 'bg-blue-50/40 font-medium' : ''
                  }`}
                  onClick={() => setSelectedRequestId(req.id)}
                >
                  <td className="px-6 py-3.5 text-sm font-bold text-[#191c1d]">{req.id}</td>
                  <td className="px-6 py-3.5 text-sm text-[#191c1d] font-semibold">{req.title}</td>
                  <td className="px-6 py-3.5 text-xs text-gray-500">{req.category}</td>
                  <td className="px-6 py-3.5 text-sm text-[#191c1d]">
                    {req.assignedOfficerName || <span className="text-amber-800 italic text-xs">Selecting researcher</span>}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ['APPROVED', 'DELIVERED', 'CLOSED'].includes(req.status) ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {getStatusLabel(req.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-[#191c1d] font-semibold">{req.deadline}</td>
                  <td className="px-6 py-3.5 text-right">
                    <button className="text-[#0037b0] hover:underline text-xs font-bold flex items-center justify-end gap-1">
                      <span>Track</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
