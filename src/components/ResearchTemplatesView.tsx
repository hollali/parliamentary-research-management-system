import React, { useState } from 'react';
import { useToast } from '../lib/toast';
import { 
  FileText, 
  Copy, 
  CheckCircle2, 
  BookOpen, 
  BarChart3, 
  Scale, 
  Globe, 
  Users
} from 'lucide-react';

interface TemplateSection {
  heading: string;
  prompt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  sections: TemplateSection[];
}

const TEMPLATES: Template[] = [
  {
    id: 'legislative-brief',
    name: 'Legislative Brief',
    description: 'Standard format for briefs on pending or proposed legislation.',
    category: 'Legislation',
    icon: <Scale className="w-5 h-5" />,
    sections: [
      { heading: 'Executive Summary', prompt: 'Provide a 2-3 paragraph summary of the key findings and recommendations.' },
      { heading: 'Background', prompt: 'Context of the legislation: when introduced, by whom, current parliamentary stage.' },
      { heading: 'Key Provisions', prompt: 'Summary of major clauses and their practical implications.' },
      { heading: 'Comparative Analysis', prompt: 'How similar legislation works in other jurisdictions (ECOWAS, Commonwealth).' },
      { heading: 'Stakeholder Views', prompt: 'Positions of government, civil society, affected groups, and international bodies.' },
      { heading: 'Fiscal Implications', prompt: 'Estimated cost to the state, revenue implications, and budget line items.' },
      { heading: 'Constitutional Considerations', prompt: 'Alignment with the 1992 Constitution and relevant court decisions.' },
      { heading: 'Recommendations', prompt: 'Specific, actionable recommendations for the Committee or House.' },
    ],
  },
  {
    id: 'policy-brief',
    name: 'Policy Brief',
    description: 'For analysis of government policies and their impact on citizens.',
    category: 'Policy',
    icon: <BarChart3 className="w-5 h-5" />,
    sections: [
      { heading: 'Issue Overview', prompt: 'What policy issue is being examined and why it matters to Parliament.' },
      { heading: 'Current Policy Landscape', prompt: 'Description of existing policies, regulations, and institutional frameworks.' },
      { heading: 'Data & Evidence', prompt: 'Key statistics, research findings, and empirical evidence relevant to the issue.' },
      { heading: 'Impact Assessment', prompt: 'How the policy affects different regions, demographics, and sectors in Ghana.' },
      { heading: 'International Benchmarks', prompt: 'Best practices and lessons from comparable countries.' },
      { heading: 'Policy Options', prompt: 'Alternative approaches Parliament could consider, with pros and cons.' },
      { heading: 'Recommendations', prompt: 'Clear, evidence-based policy recommendations with implementation considerations.' },
    ],
  },
  {
    id: 'committee-report',
    name: 'Committee Report',
    description: 'Formal report structure for committee inquiries and investigations.',
    category: 'Committee',
    icon: <Users className="w-5 h-5" />,
    sections: [
      { heading: 'Mandate & Scope', prompt: 'Terms of reference, timeline, and authority under which the inquiry was conducted.' },
      { heading: 'Methodology', prompt: 'How information was gathered: hearings, site visits, document review, interviews.' },
      { heading: 'Background & Context', prompt: 'Historical context and preceding events that led to the inquiry.' },
      { heading: 'Findings of Fact', prompt: 'Objective, evidence-based findings organized by theme or issue area.' },
      { heading: 'Analysis & Discussion', prompt: 'Interpretation of findings, root causes, and systemic issues identified.' },
      { heading: 'Stakeholder Submissions', prompt: 'Summary of key testimony and submissions received.' },
      { heading: 'Recommendations', prompt: 'Numbered, specific recommendations directed at responsible entities.' },
      { heading: 'Dissenting Views', prompt: 'Any minority reports or differing opinions among committee members.' },
    ],
  },
  {
    id: 'research-summary',
    name: 'Research Summary',
    description: 'Concise summary format for completed research deliverables.',
    category: 'Research',
    icon: <BookOpen className="w-5 h-5" />,
    sections: [
      { heading: 'Research Question', prompt: 'The specific question(s) this research sought to answer.' },
      { heading: 'Methodology', prompt: 'Research design, data sources, analytical methods used.' },
      { heading: 'Key Findings', prompt: 'Bullet-point summary of the most important discoveries.' },
      { heading: 'Detailed Analysis', prompt: 'In-depth discussion of findings with supporting evidence and data.' },
      { heading: 'Implications for Parliament', prompt: 'How findings relate to current legislative or oversight activities.' },
      { heading: 'Limitations', prompt: 'Constraints, gaps in data, and areas requiring further research.' },
      { heading: 'References', prompt: 'Key sources consulted during the research.' },
    ],
  },
  {
    id: 'hansard-summary',
    name: 'Hansard Summary',
    description: 'Format for summarizing parliamentary debate proceedings.',
    category: 'Proceedings',
    icon: <Globe className="w-5 h-5" />,
    sections: [
      { heading: 'Session Details', prompt: 'Date, sitting number, presiding officer, quorum confirmation.' },
      { heading: 'Order of Business', prompt: 'Sequence of items on the day\'s agenda.' },
      { heading: 'Key Debates', prompt: 'Summary of major floor debates including positions taken by both sides.' },
      { heading: 'Motions & Votes', prompt: 'All motions proposed, seconded, and voted upon with results.' },
      { heading: 'Questions to Ministers', prompt: 'Notable oral and written questions and ministerial responses.' },
      { heading: 'Committee Reports Presented', prompt: 'Reports tabled and any actions requested of the House.' },
      { heading: 'Announcements', prompt: 'Official announcements, upcoming sittings, and adjournment.' },
    ],
  },
];

export const ResearchTemplatesView: React.FC = () => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [copied, setCopied] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('prrms_custom_templates');
    return saved ? JSON.parse(saved) : [];
  });
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const allTemplates = [...TEMPLATES, ...customTemplates];

  const saveCustomTemplates = (templates: Template[]) => {
    setCustomTemplates(templates);
    localStorage.setItem('prrms_custom_templates', JSON.stringify(templates));
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) {
      toast.error('Template name is required');
      return;
    }
    const newTemplate: Template = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      description: customDescription.trim() || 'Custom research template',
      category: 'Custom',
      icon: <FileText className="w-5 h-5" />,
      sections: [
        { heading: 'Introduction', prompt: 'Provide context and purpose of this research document.' },
        { heading: 'Methodology', prompt: 'Describe the research approach and data sources used.' },
        { heading: 'Findings', prompt: 'Present the key findings with supporting evidence.' },
        { heading: 'Analysis', prompt: 'Interpret findings and discuss implications.' },
        { heading: 'Recommendations', prompt: 'Provide actionable recommendations based on the analysis.' },
      ],
    };
    saveCustomTemplates([...customTemplates, newTemplate]);
    setCustomName('');
    setCustomDescription('');
    setShowNewForm(false);
    setSelectedTemplate(newTemplate);
    toast.success('Custom template created');
  };

  const handleDeleteCustom = (templateId: string) => {
    const updated = customTemplates.filter((t) => t.id !== templateId);
    saveCustomTemplates(updated);
    if (selectedTemplate?.id === templateId) setSelectedTemplate(null);
    toast.success('Template deleted');
  };

  const generateMarkdown = (template: Template): string => {
    let md = `# ${template.name}\n\n`;
    md += `> ${template.description}\n\n`;
    template.sections.forEach((s, i) => {
      md += `## ${i + 1}. ${s.heading}\n\n`;
      md += `_${s.prompt}_\n\n`;
      md += `[Content goes here]\n\n`;
    });
    return md;
  };

  const handleCopy = (template: Template) => {
    const md = generateMarkdown(template);
      navigator.clipboard.writeText(md).then(() => {
        setCopied(true);
        toast.success('Template copied. Paste into your report draft to use.');
        setTimeout(() => setCopied(false), 2000);
      });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Research Output Templates</h2>
          <p className="font-sans text-sm text-[#434655] mt-1">Pre-defined report structures for common research deliverables.</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-[#0037b0] text-white text-xs font-bold px-4 py-2 rounded shadow hover:bg-[#1d4ed8] transition-all"
        >
          {showNewForm ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {showNewForm && (
        <div className="bg-white border border-[#0037b0] rounded-lg shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-sm text-[#191c1d]">Create Custom Template</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">Template Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Budget Analysis Brief"
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">Description</label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Brief description of the template purpose"
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">New templates include 5 default sections (Introduction, Methodology, Findings, Analysis, Recommendations). You can copy and customize after creation.</p>
          <button
            onClick={handleCreateCustom}
            className="bg-[#0037b0] text-white text-xs font-bold px-4 py-2 rounded shadow hover:bg-[#1d4ed8] transition-all"
          >
            Create Template
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {allTemplates.map((t) => (
          <div
            key={t.id}
            className={`bg-white border rounded-lg shadow-sm p-5 cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate?.id === t.id
                ? 'border-[#0037b0] ring-2 ring-[#0037b0] ring-inset'
                : 'border-[#c4c5d7] hover:border-gray-300'
            }`}
            onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-[#0037b0] shrink-0">
                {t.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-sans font-bold text-sm text-[#191c1d]">{t.name}</h3>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">{t.category}</p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{t.description}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-semibold">
                {t.sections.length} sections
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(t); }}
                  className="text-[10px] font-bold text-[#0037b0] hover:underline flex items-center gap-1"
                >
                  {copied && selectedTemplate?.id === t.id ? (
                    <><CheckCircle2 className="w-3 h-3" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copy</>
                  )}
                </button>
                {t.id.startsWith('custom-') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustom(t.id); }}
                    className="text-[10px] font-bold text-[#ba1a1a] hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview panel */}
      {selectedTemplate && (
        <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-sans font-bold text-base text-[#191c1d]">{selectedTemplate.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{selectedTemplate.description}</p>
            </div>
            <button
              onClick={() => handleCopy(selectedTemplate)}
              className="px-3 py-1.5 bg-[#0037b0] text-white text-[11px] font-bold rounded hover:bg-[#1d4ed8] transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" /> Copy to Clipboard
            </button>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {selectedTemplate.sections.map((s, i) => (
                <div key={i} className="border-l-2 border-blue-200 pl-4">
                  <h4 className="font-sans font-bold text-sm text-[#191c1d]">
                    {i + 1}. {s.heading}
                  </h4>
                  <p className="text-xs text-gray-500 italic mt-1">{s.prompt}</p>
                  <div className="mt-2 bg-gray-50 border border-gray-100 rounded p-3 min-h-[40px]">
                    <span className="text-[10px] text-gray-300 italic">Content placeholder</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
