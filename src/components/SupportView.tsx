import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Phone, Mail, BookOpen, MessageSquare } from 'lucide-react';

const FAQ_ITEMS = [
  {
    q: 'How do I submit a new research request?',
    a: 'Navigate to the Requests section and click "New Research Request". Fill in the title, description, priority, deadline, and any relevant committee. Only ADMIN and MP roles can submit requests.',
  },
  {
    q: 'How do I upload a research draft?',
    a: 'Open your assigned request from the Officer Workflow view. Use the "Briefing Attachment Slots" area to drag and drop files or click to browse. Accepted formats: PDF, DOCX, XLSX, and ZIP (max 50 MB).',
  },
  {
    q: 'How do I accept or decline an assignment?',
    a: 'In the Officer Workflow view, pending assignments show "Accept" and "Decline" buttons at the top of the detail panel. Accepting moves the request to "In Progress". Declining removes you from the assignment.',
  },
  {
    q: 'Can I change my password?',
    a: 'Yes. Go to Settings from the sidebar, scroll to the "Change Password" section, enter your current password and the new one, and click "Update Password".',
  },
  {
    q: 'How do I share a completed research report with another committee?',
    a: 'Open the request from the Committee Workbench or Archive, and use the "Share with Committee" option. Select the target committee(s) and confirm. They will receive a notification.',
  },
  {
    q: 'What file formats are accepted for uploads?',
    a: 'The system accepts PDF (.pdf), Microsoft Word (.docx), Microsoft Excel (.xlsx), and ZIP archives (.zip). All other file types are rejected during upload.',
  },
];

export const SupportView: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm p-8 space-y-6">
        <div className="text-center space-y-4">
          <HelpCircle className="w-12 h-12 text-[#0037b0] mx-auto" />
          <h3 className="text-2xl font-sans font-bold text-gray-900">Parliamentary Support Center</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Need assistance with the PRRMS platform? Contact our support desks or browse the frequently asked questions below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="border border-gray-100 bg-gray-50 p-6 rounded-lg space-y-2 hover:border-[#0037b0] transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Phone className="w-4 h-4 text-[#0037b0]" />
              <h4 className="font-bold text-sm text-[#191c1d]">Technical Helpdesk</h4>
            </div>
            <p className="text-xs text-gray-500">For issues with account access, file uploads, or system errors.</p>
            <p className="text-sm font-semibold text-[#0037b0] pt-1">Extension: +4412</p>
            <p className="text-sm font-semibold text-[#0037b0]">Email: it-support@parliament.gov</p>
            <p className="text-[10px] text-gray-400 pt-1">Available: Mon–Fri, 8:00 AM – 5:00 PM GMT</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 p-6 rounded-lg space-y-2 hover:border-[#0037b0] transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-[#0037b0]" />
              <h4 className="font-bold text-sm text-[#191c1d]">Research Directorate</h4>
            </div>
            <p className="text-xs text-gray-500">For questions regarding inquiry formatting, deadlines, or jurisdiction.</p>
            <p className="text-sm font-semibold text-[#0037b0] pt-1">Extension: +4199</p>
            <p className="text-sm font-semibold text-[#0037b0]">Email: research-desk@parliament.gov</p>
            <p className="text-[10px] text-gray-400 pt-1">Available: Mon–Fri, 8:00 AM – 5:00 PM GMT</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#0037b0]" />
          <h3 className="font-sans font-bold text-[#191c1d]">Frequently Asked Questions</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-semibold text-[#191c1d] pr-4">{item.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4">
                  <p className="text-xs text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
