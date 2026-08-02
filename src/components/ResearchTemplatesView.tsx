import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import {
  FileText,
  Copy,
  CheckCircle2,
  BookOpen,
  BarChart3,
  Scale,
  Globe,
  Users,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  Eye,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Legislation: <Scale className="w-5 h-5" />,
  Policy: <BarChart3 className="w-5 h-5" />,
  Committee: <Users className="w-5 h-5" />,
  Research: <BookOpen className="w-5 h-5" />,
  Proceedings: <Globe className="w-5 h-5" />,
  Custom: <FileText className="w-5 h-5" />,
};

const CATEGORIES = ['Legislation', 'Policy', 'Committee', 'Research', 'Proceedings', 'Custom'];

interface SectionDraft {
  heading: string;
  prompt: string;
}

const DEFAULT_SECTIONS: SectionDraft[] = [
  { heading: 'Introduction', prompt: 'Provide context and purpose of this research document.' },
  { heading: 'Methodology', prompt: 'Describe the research approach and data sources used.' },
  { heading: 'Findings', prompt: 'Present the key findings with supporting evidence.' },
  { heading: 'Analysis', prompt: 'Interpret findings and discuss implications.' },
  { heading: 'Recommendations', prompt: 'Provide actionable recommendations based on the analysis.' },
];

const OVERLAY_STYLE = { top: '-100px', bottom: '-100px', width: '200vw', left: '50%', transform: 'translateX(-50%)' };

export const ResearchTemplatesView: React.FC = () => {
  const { templates, addTemplate, removeTemplate } = useApp();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalCategory, setModalCategory] = useState('Custom');
  const [modalSections, setModalSections] = useState<SectionDraft[]>(DEFAULT_SECTIONS.map((s) => ({ ...s })));
  const [modalErrors, setModalErrors] = useState<{ name?: string; sections?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const resetModal = useCallback(() => {
    setModalName('');
    setModalDescription('');
    setModalCategory('Custom');
    setModalSections(DEFAULT_SECTIONS.map((s) => ({ ...s })));
    setModalErrors({});
    setSubmitting(false);
  }, []);

  const openModal = () => { resetModal(); setShowModal(true); };
  const closeModal = () => { setShowModal(false); resetModal(); };

  const addSection = () => setModalSections((p) => [...p, { heading: '', prompt: '' }]);
  const removeSection = (i: number) => { if (modalSections.length > 1) setModalSections((p) => p.filter((_, j) => j !== i)); };
  const updateSection = (i: number, field: 'heading' | 'prompt', v: string) =>
    setModalSections((p) => p.map((s, j) => (j === i ? { ...s, [field]: v } : s)));
  const moveSection = (i: number, d: -1 | 1) => {
    const t = i + d;
    if (t < 0 || t >= modalSections.length) return;
    setModalSections((p) => { const n = [...p]; [n[i], n[t]] = [n[t], n[i]]; return n; });
  };

  const validateModal = (): boolean => {
    const e: { name?: string; sections?: string } = {};
    if (!modalName.trim()) e.name = 'Template name is required';
    if (modalSections.some((s) => !s.heading.trim())) e.sections = 'All sections must have a heading';
    setModalErrors(e);
    return Object.keys(e).length === 0;
  };

  const selectedTemplate = templates.find((t) => t.id === selectedId) || null;

  const generateMarkdown = (name: string, desc: string, sections: { heading: string; prompt: string }[]): string => {
    let md = `# ${name}\n\n> ${desc}\n\n`;
    sections.forEach((s, i) => { md += `## ${i + 1}. ${s.heading}\n\n_${s.prompt}_\n\n[Content goes here]\n\n`; });
    return md;
  };

  const handleCopy = (t: typeof templates[0]) => {
    const sections = t.sections as { heading: string; prompt: string }[];
    navigator.clipboard.writeText(generateMarkdown(t.name, t.description || '', sections)).then(() => {
      setCopiedId(t.id);
      toast.success('Template copied. Paste into your report draft to use.');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCreate = async () => {
    if (!validateModal()) return;
    const cleaned = modalSections.filter((s) => s.heading.trim()).map((s) => ({ heading: s.heading.trim(), prompt: s.prompt.trim() }));
    try {
      setSubmitting(true);
      const created = await addTemplate(modalName.trim(), modalDescription.trim() || undefined, modalCategory, cleaned);
      setShowModal(false); resetModal(); setSelectedId(created.id);
      toast.success('Template created');
    } catch { toast.error('Failed to create template'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try { await removeTemplate(id); if (selectedId === id) setSelectedId(null); toast.success('Template deleted'); }
    catch { toast.error('Failed to delete template'); }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-sans font-bold text-3xl text-[#191c1d]">Research Output Templates</h2>
          <p className="font-sans text-base text-[#434655] mt-1.5">
            Pre-defined report structures for common research deliverables.
            {templates.length > 0 && <span className="text-gray-400 ml-1.5">({templates.length} available)</span>}
          </p>
        </div>
        <button onClick={openModal} className="bg-[#0037b0] text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow hover:bg-[#1d4ed8] transition-all">
          + New Template
        </button>
      </div>

      {/* ── Template cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {templates.map((t) => {
          const sections = t.sections as { heading: string; prompt: string }[];
          const icon = CATEGORY_ICONS[t.category] || CATEGORY_ICONS.Custom;
          return (
            <div key={t.id} className={`bg-white border-2 rounded-xl shadow-sm transition-all hover:shadow-lg ${selectedId === t.id ? 'border-[#0037b0] ring-2 ring-[#0037b0] ring-inset' : 'border-[#e0e1e6] hover:border-gray-300'}`}>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-[#0037b0] shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-sans font-bold text-lg text-[#191c1d] leading-tight">{t.name}</h3>
                    <span className="inline-block mt-1.5 text-xs text-[#0037b0] bg-blue-50 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">{t.category}</span>
                    {t.description && <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">{t.description}</p>}
                  </div>
                </div>

                {/* Section list */}
                <div className="mt-4 bg-[#f9fafb] border border-[#e5e7eb] rounded-lg px-4 py-3">
                  <div className="space-y-1.5">
                    {sections.map((s, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-gray-300 w-5 text-right shrink-0">{i + 1}.</span>
                        <span className="text-sm text-[#434655]">{s.heading}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card footer */}
              <div className="px-6 py-4 border-t border-[#f0f0f2] flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">
                  {sections.length} sections{t.isBuiltIn && <span className="ml-1.5 text-[#0037b0]">(Built-in)</span>}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedId(t.id)} className="p-2.5 rounded-lg bg-[#0037b0] text-white hover:bg-[#1d4ed8] transition-colors shadow-sm" title="View template">
                    <Eye className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleCopy(t)} className="p-2.5 rounded-lg bg-blue-50 text-[#0037b0] hover:bg-blue-100 transition-colors" title="Copy template">
                    {copiedId === t.id ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                  {!t.isBuiltIn && (
                    <button onClick={() => handleDelete(t.id)} className="p-2.5 rounded-lg bg-red-50 text-[#ba1a1a] hover:bg-red-100 transition-colors" title="Delete template">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {templates.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-400">
            <FileText className="w-14 h-14 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-semibold">No templates available</p>
            <p className="text-sm mt-1.5">Create a custom template or contact your administrator.</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          PREVIEW MODAL
         ═══════════════════════════════════════════════════════ */}
      {selectedTemplate && (
        <>
          <div className="fixed z-50 bg-black/50 backdrop-blur-sm" style={OVERLAY_STYLE} onClick={() => setSelectedId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="px-10 py-6 border-b border-gray-200 flex items-start justify-between shrink-0">
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-6">
                  <div className="p-4 bg-blue-50 rounded-xl text-[#0037b0] shrink-0">
                    {CATEGORY_ICONS[selectedTemplate.category] || CATEGORY_ICONS.Custom}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-sans font-bold text-2xl text-[#191c1d] leading-tight">{selectedTemplate.name}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-[#0037b0] bg-blue-50 px-3 py-1 rounded-full font-bold uppercase tracking-wide">{selectedTemplate.category}</span>
                      <span className="text-sm text-gray-400 font-semibold">
                        {(selectedTemplate.sections as { heading: string; prompt: string }[]).length} sections
                      </span>
                      {selectedTemplate.isBuiltIn && <span className="text-sm text-[#0037b0] font-semibold">(Built-in)</span>}
                    </div>
                    {selectedTemplate.description && <p className="text-base text-gray-500 mt-3 leading-relaxed">{selectedTemplate.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => handleCopy(selectedTemplate)} className="px-5 py-2.5 bg-[#0037b0] text-white text-sm font-bold rounded-lg hover:bg-[#1d4ed8] transition-colors flex items-center gap-2 shadow">
                    <Copy className="w-4 h-4" /> Copy to Clipboard
                  </button>
                  <button onClick={() => setSelectedId(null)} className="p-2.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              {/* Sections */}
              <div className="px-10 py-8 overflow-y-auto flex-1">
                <div className="space-y-8 max-w-4xl">
                  {(selectedTemplate.sections as { heading: string; prompt: string }[]).map((s, i) => (
                    <div key={i} className="border-l-4 border-blue-200 pl-8">
                      <h4 className="font-sans font-bold text-xl text-[#191c1d]">{i + 1}. {s.heading}</h4>
                      <p className="text-base text-gray-500 italic mt-2 leading-relaxed">{s.prompt}</p>
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-5 min-h-[72px]">
                        <span className="text-sm text-gray-300 italic">Content placeholder</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          CREATE MODAL
         ═══════════════════════════════════════════════════════ */}
      {showModal && (
        <>
          <div className="fixed z-50 bg-black/50 backdrop-blur-sm" style={OVERLAY_STYLE} onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-full max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="px-8 py-5 border-b border-gray-200 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-sans font-bold text-xl text-[#191c1d]">Create Custom Template</h2>
                  <p className="text-sm text-gray-400 mt-1">Define the structure and section prompts for your template.</p>
                </div>
                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-8 py-6 space-y-6 overflow-y-auto flex-1">
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#434655] uppercase">Template Name <span className="text-[#ba1a1a]">*</span></label>
                  <input type="text" value={modalName} onChange={(e) => { setModalName(e.target.value); setModalErrors((p) => ({ ...p, name: undefined })); }}
                    placeholder="e.g. Budget Analysis Brief"
                    className={`w-full bg-[#f3f4f5] border-2 rounded-lg p-3.5 text-sm outline-none transition-colors ${modalErrors.name ? 'border-[#ba1a1a]' : 'border-[#c4c5d7] focus:border-[#0037b0]'}`} />
                  {modalErrors.name && <p className="text-xs text-[#ba1a1a] font-semibold">{modalErrors.name}</p>}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#434655] uppercase">Description</label>
                  <textarea value={modalDescription} onChange={(e) => setModalDescription(e.target.value)}
                    placeholder="Brief description of when and how this template should be used" rows={3}
                    className="w-full bg-[#f3f4f5] border-2 border-[#c4c5d7] rounded-lg p-3.5 text-sm outline-none focus:border-[#0037b0] transition-colors resize-none" />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#434655] uppercase">Category</label>
                  <div className="flex flex-wrap gap-2.5">
                    {CATEGORIES.map((cat) => (
                      <button key={cat} onClick={() => setModalCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${modalCategory === cat ? 'bg-[#0037b0] text-white border-[#0037b0]' : 'bg-white text-[#434655] border-[#c4c5d7] hover:border-[#0037b0] hover:text-[#0037b0]'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Sections ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-[#434655] uppercase">Sections <span className="text-[#ba1a1a]">*</span></label>
                    <button onClick={addSection} className="flex items-center gap-1.5 text-sm font-bold text-white bg-[#0037b0] hover:bg-[#1d4ed8] px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                      <Plus className="w-4 h-4" /> Add Section
                    </button>
                  </div>
                  {modalErrors.sections && <p className="text-xs text-[#ba1a1a] font-semibold">{modalErrors.sections}</p>}

                  <div className="space-y-4">
                    {modalSections.map((section, i) => (
                      <div key={i} className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-400 w-6 text-center shrink-0">{i + 1}</span>
                          <input type="text" value={section.heading} onChange={(e) => { updateSection(i, 'heading', e.target.value); setModalErrors((p) => ({ ...p, sections: undefined })); }}
                            placeholder="Section heading"
                            className="flex-1 bg-white border border-[#d1d5db] rounded-lg px-4 py-2.5 text-sm font-bold text-[#191c1d] outline-none focus:border-[#0037b0] transition-colors" />
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => moveSection(i, -1)} disabled={i === 0}
                              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500" title="Move up">
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveSection(i, 1)} disabled={i === modalSections.length - 1}
                              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500" title="Move down">
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeSection(i)} disabled={modalSections.length <= 1}
                              className="p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-[#ba1a1a]" title="Remove section">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <textarea value={section.prompt} onChange={(e) => updateSection(i, 'prompt', e.target.value)}
                          placeholder="Guidance prompt for this section (what the author should address)" rows={2}
                          className="w-full bg-white border border-[#d1d5db] rounded-lg px-4 py-2.5 text-sm text-[#434655] italic outline-none focus:border-[#0037b0] transition-colors resize-none" />
                      </div>
                    ))}
                  </div>

                  {/* Add section — bottom button */}
                  <button onClick={addSection}
                    className="w-full py-3 border-2 border-dashed border-[#c4c5d7] rounded-xl text-sm font-bold text-[#0037b0] hover:border-[#0037b0] hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add another section
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-5 border-t border-gray-200 flex items-center justify-between shrink-0">
                <span className="text-xs text-gray-400 font-semibold">{modalSections.length} section{modalSections.length !== 1 ? 's' : ''}</span>
                <div className="flex items-center gap-4">
                  <button onClick={closeModal} className="px-5 py-2.5 text-sm font-bold text-[#434655] hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleCreate} disabled={submitting}
                    className="px-5 py-2.5 bg-[#0037b0] text-white text-sm font-bold rounded-lg shadow hover:bg-[#1d4ed8] disabled:opacity-50 transition-all">
                    {submitting ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
