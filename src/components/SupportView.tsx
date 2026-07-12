import React from 'react';
import { HelpCircle } from 'lucide-react';

export const SupportView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm p-8 space-y-6">
        <div className="text-center space-y-4">
          <HelpCircle className="w-12 h-12 text-[#0037b0] mx-auto" />
          <h3 className="text-2xl font-sans font-bold text-gray-900">Parliamentary Support Center</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Need assistance with the PRRMS platform? Contact our technical and operational support desks for immediate resolution.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="border border-gray-100 bg-gray-50 p-6 rounded-lg space-y-2 hover:border-[#0037b0] transition-colors cursor-pointer">
            <h4 className="font-bold text-sm text-[#191c1d]">Technical Helpdesk</h4>
            <p className="text-xs text-gray-500">For issues with account access, file uploads, or system errors.</p>
            <p className="text-sm font-semibold text-[#0037b0] pt-2">Extension: +4412</p>
            <p className="text-sm font-semibold text-[#0037b0]">Email: it-support@parliament.gov</p>
          </div>
          <div className="border border-gray-100 bg-gray-50 p-6 rounded-lg space-y-2 hover:border-[#0037b0] transition-colors cursor-pointer">
            <h4 className="font-bold text-sm text-[#191c1d]">Research Directorate</h4>
            <p className="text-xs text-gray-500">For questions regarding inquiry formatting, deadlines, or jurisdiction.</p>
            <p className="text-sm font-semibold text-[#0037b0] pt-2">Extension: +4199</p>
            <p className="text-sm font-semibold text-[#0037b0]">Email: research-desk@parliament.gov</p>
          </div>
        </div>
      </div>
    </div>
  );
};
