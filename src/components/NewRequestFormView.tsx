import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getCommittees } from '../lib/api';
import type { Committee } from '../types';
import { validateForm, validateRequired, validateMinLength, validateDeadline, type ValidationError } from '../lib/validation';
import { 
  FileText, 
  BookOpen, 
  Clock, 
  Paperclip, 
  Check, 
  ArrowLeft, 
  ArrowRight, 
  HelpCircle, 
  Lock, 
  ChevronDown, 
  Bold, 
  Italic, 
  Link2, 
  List, 
  AlignLeft, 
  RotateCcw, 
  RotateCw, 
  Upload,
  Sparkles
} from 'lucide-react';

interface NewRequestFormViewProps {
  onSuccess: () => void;
}

export const NewRequestFormView: React.FC<NewRequestFormViewProps> = ({ onSuccess }) => {
  const { currentUser, addRequest } = useApp();
  const [step, setStep] = useState(1);
  
  // Committees from API
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loadingCommittees, setLoadingCommittees] = useState(true);

  useEffect(() => {
    getCommittees().then((data) => {
      setCommittees(Array.isArray(data) ? data : []);
      setLoadingCommittees(false);
    }).catch(() => setLoadingCommittees(false));
  }, []);
  
  const getDefaultDeadline = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  };

  // Form state
  const [committee, setCommittee] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('English');
  const [deadline, setDeadline] = useState(getDefaultDeadline);
  const [priority, setPriority] = useState<'STANDARD' | 'URGENT'>('STANDARD');
  
  // Attachment state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string, size: string }>>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const getFieldError = (field: string) => errors.find(e => e.field === field)?.message;

  const validateStep = (stepToValidate: number): ValidationError[] => {
    const fieldsToValidate: Record<string, { value: string; validators: ((val: string) => string | null)[] }> = {};
    if (stepToValidate === 1) {
      fieldsToValidate.topic = { value: topic, validators: [v => validateRequired(v, 'Inquiry topic'), v => validateMinLength(v, 5, 'Inquiry topic')] };
    }
    if (stepToValidate === 2) {
      fieldsToValidate.description = { value: description, validators: [v => validateRequired(v, 'Inquiry scope'), v => validateMinLength(v, 10, 'Inquiry scope')] };
    }
    if (stepToValidate === 3) {
      fieldsToValidate.deadline = { value: deadline, validators: [validateDeadline] };
    }
    return validateForm(fieldsToValidate);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) {
      setUploadedFiles(prev => [
        ...prev,
        ...files.map((f: File) => ({ name: f.name, size: (f.size / (1024 * 1024)).toFixed(1) + ' MB' }))
      ]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      setUploadedFiles(prev => [
        ...prev,
        ...files.map((f: File) => ({ name: f.name, size: (f.size / (1024 * 1024)).toFixed(1) + ' MB' }))
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allErrors = [
      ...validateStep(1),
      ...validateStep(2),
      ...validateStep(3),
    ];
    setErrors(allErrors);
    if (allErrors.length > 0) return;
    setSubmitting(true);
    
    setTimeout(() => {
      // call context submit
      addRequest({
        title: topic || 'Legislative Inquiry: ' + committee,
        topic: topic || committee + ' Inquiry',
        category: committee,
        member: currentUser.name,
        assignedOfficerId: null,
        assignedOfficerName: null,
        status: 'SUBMITTED',
        priority,
        deadline: new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        description,
        language,
        attachments: uploadedFiles.map(f => {
          let type: 'pdf' | 'xlsx' | 'docx' = 'pdf';
          if (f.name.toLowerCase().endsWith('.xlsx')) type = 'xlsx';
          if (f.name.toLowerCase().endsWith('.docx')) type = 'docx';
          return {
            name: f.name,
            size: f.size,
            type
          };
        })
      });
      
      setSubmitting(false);
      setShowSuccess(true);
    }, 1000);
  };

  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-6 bg-white border border-[#c4c5d7] rounded-lg p-10 shadow-lg animate-fadeIn mt-10">
        <div className="w-16 h-16 bg-emerald-100 text-[#006b2c] rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50">
          <Check className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-[#191c1d]">Legislative Inquiry Filed</h3>
          <p className="text-sm text-[#434655] max-w-md mx-auto">
            Your inquiry has been successfully registered and routed to the research desk. An administrative officer will assign a researcher shortly.
          </p>
        </div>
        <div className="pt-4">
          <button 
            onClick={onSuccess}
            className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-semibold px-6 py-2.5 rounded-lg transition-all"
          >
            Go to Portal Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div>
        <h2 className="font-sans font-bold text-2xl text-[#191c1d]">New Research Request</h2>
        <p className="font-sans text-sm text-[#434655] mt-1">Initiate a new high-fidelity legislative inquiry with the research directorate.</p>
      </div>

      {/* 3 Step Progress Indicator */}
      <div className="bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-xs ${
            step > 1 ? 'bg-[#006b2c] text-white' : step === 1 ? 'bg-[#0037b0] text-white' : 'bg-white text-gray-500 border border-gray-300'
          }`}>
            {step > 1 ? <Check className="w-4 h-4" /> : '1'}
          </div>
          <span className={`text-sm font-bold ${step === 1 ? 'text-[#0037b0]' : 'text-gray-500'}`}>Basic Information</span>
        </div>
        <div className="flex-1 h-px bg-[#c4c5d7] mx-6"></div>
        
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-xs ${
            step > 2 ? 'bg-[#006b2c] text-white' : step === 2 ? 'bg-[#0037b0] text-white' : 'bg-white text-gray-500 border border-gray-300'
          }`}>
            {step > 2 ? <Check className="w-4 h-4" /> : '2'}
          </div>
          <span className={`text-sm font-bold ${step === 2 ? 'text-[#0037b0]' : 'text-gray-500'}`}>Request Details</span>
        </div>
        <div className="flex-1 h-px bg-[#c4c5d7] mx-6"></div>

        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-xs ${
            step === 3 ? 'bg-[#0037b0] text-white' : 'bg-white text-gray-500 border border-gray-300'
          }`}>
            '3'
          </div>
          <span className={`text-sm font-bold ${step === 3 ? 'text-[#0037b0]' : 'text-gray-500'}`}>Timeline & Attachments</span>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form Panels */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* STEP 1: BASIC INFORMATION */}
            {step === 1 && (
              <div className="space-y-5 animate-fadeIn">
                <h3 className="font-sans font-bold text-lg text-[#191c1d] border-b border-gray-100 pb-3">Basic Information</h3>
                
                {/* Committee Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#434655] uppercase tracking-wider">Target Committee Jurisdiction</label>
                  <div className="relative">
                    <select 
                      value={committee}
                      onChange={(e) => setCommittee(e.target.value)}
                      disabled={loadingCommittees}
                      className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg px-4 py-3 appearance-none text-sm outline-none focus:ring-2 focus:ring-[#0037b0]"
                    >
                      <option value="">
                        {loadingCommittees ? 'Loading committees...' : 'Select a committee'}
                      </option>
                      {committees.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.shortName ? `${c.shortName} - ` : ''}{c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#747686]" />
                  </div>
                  {committee && committees.find(c => c.name === committee) && (
                    <div className="mt-1.5 p-2 bg-gray-50 border border-gray-100 rounded text-[10px] text-gray-500">
                      <span className="font-semibold">Chairperson:</span> {committees.find(c => c.name === committee)?.chairperson || 'N/A'} •{' '}
                      <span className="font-semibold">Clerk:</span> {committees.find(c => c.name === committee)?.clerk || 'N/A'}
                    </div>
                  )}
                </div>

                {/* Submitting Requestor */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#434655] uppercase tracking-wider">Requestor Name</label>
                  <input 
                    type="text" 
                    value={currentUser.name} 
                    disabled
                    className="w-full bg-gray-100 border border-[#c4c5d7] rounded-lg px-4 py-3 text-sm text-[#434655] outline-none"
                  />
                  <p className="text-[10px] text-gray-500">Automatically populated from your authenticated session.</p>
                </div>

                {/* Specific Topic / Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#434655] uppercase tracking-wider">Specific inquiry topic</label>
                  <input 
                    type="text" 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onBlur={() => {
                      const fieldErrors = validateForm({
                        topic: { value: topic, validators: [v => validateRequired(v, 'Inquiry topic'), v => validateMinLength(v, 5, 'Inquiry topic')] }
                      });
                      setErrors(prev => [...prev.filter(e => e.field !== 'topic'), ...fieldErrors]);
                    }}
                    placeholder="e.g. Legal Framework for Autonomous Vehicle Liability"
                    className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0037b0]"
                  />
                  {getFieldError('topic') && (
                    <p className="text-[10px] text-red-600">{getFieldError('topic')}</p>
                  )}
                </div>

                {/* Drag and Drop Zone */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5 text-gray-500" /> Reference Bills / Appendices (Optional)
                  </label>
                  
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                      isDragOver ? 'border-[#0037b0] bg-blue-50/50' : 'border-[#c4c5d7] bg-gray-50 hover:bg-gray-100/50'
                    }`}
                  >
                    <input 
                      id="file-upload-input"
                      type="file" 
                      multiple 
                      onChange={handleFileInput}
                      className="hidden" 
                    />
                    <div className="w-12 h-12 bg-white text-gray-400 border border-gray-200 shadow-sm rounded-lg flex items-center justify-center">
                      <Upload className="w-6 h-6 text-[#0037b0]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Drag & drop files here, or click to browse</p>
                      <p className="text-[10px] text-gray-500 mt-1">Supports PDF, DOCX, XLSX up to 30MB</p>
                    </div>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-xs font-bold text-[#191c1d]">Uploaded Attachments ({uploadedFiles.length}):</p>
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 flex justify-between items-center text-xs">
                          <span className="font-semibold text-[#191c1d] truncate max-w-[300px]">{file.name}</span>
                          <span className="text-gray-500 font-bold">{file.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: REQUEST DETAILS */}
            {step === 2 && (
              <div className="space-y-5 animate-fadeIn">
                <h3 className="font-sans font-bold text-lg text-[#191c1d] border-b border-gray-100 pb-3">Inquiry Details</h3>

                {/* Policy / Research question details */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#434655] uppercase tracking-wider">Inquiry Scope & Key Research Questions</label>
                    <span className="text-[10px] text-[#0037b0] font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#0037b0]" /> Use official brief layout
                    </span>
                  </div>

                  {/* Formatting Toolbar */}
                  <div className="border border-[#c4c5d7] rounded-lg overflow-hidden">
                    <div className="bg-[#f3f4f5] border-b border-[#c4c5d7] px-3 py-2 flex items-center gap-1.5 flex-wrap">
                      <button type="button" className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors" title="Undo"><RotateCcw className="w-3.5 h-3.5" /></button>
                      <button type="button" className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors" title="Redo"><RotateCw className="w-3.5 h-3.5" /></button>
                      <div className="w-px h-4 bg-[#c4c5d7] mx-1"></div>
                      <button type="button" className="p-1 bg-gray-200 rounded text-gray-800 font-bold" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                      <button type="button" className="p-1 hover:bg-gray-200 rounded text-gray-600 italic" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                      <button type="button" className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Add Link"><Link2 className="w-3.5 h-3.5" /></button>
                      <div className="w-px h-4 bg-[#c4c5d7] mx-1"></div>
                      <button type="button" className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                      <button type="button" className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Align Left"><AlignLeft className="w-3.5 h-3.5" /></button>
                    </div>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        const fieldErrors = validateForm({
                          description: { value: description, validators: [v => validateRequired(v, 'Inquiry scope'), v => validateMinLength(v, 10, 'Inquiry scope')] }
                        });
                        setErrors(prev => [...prev.filter(e => e.field !== 'description'), ...fieldErrors]);
                      }}
                      placeholder="Detail the background legislative contexts, specific clauses under discussion, and exact statistical variables or historical models your office requires..."
                      className="w-full bg-white px-4 py-3 h-48 outline-none text-sm resize-none"
                    />
                    {getFieldError('description') && (
                      <p className="text-[10px] text-red-600">{getFieldError('description')}</p>
                    )}
                  </div>
                </div>

                {/* Language of Delivery */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#434655] uppercase tracking-wider">Required Delivery Format</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['English Only', 'Bilingual (Full)', 'Bilingual (Executive Summary)'].map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        className={`py-2.5 px-3 border rounded-lg text-xs font-bold transition-all text-center ${
                          language === lang 
                            ? 'bg-blue-50 border-[#0037b0] text-[#0037b0]' 
                            : 'bg-white border-[#c4c5d7] text-[#434655] hover:bg-gray-50'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: TIMELINE & ATTACHMENTS */}
            {step === 3 && (
              <div className="space-y-5 animate-fadeIn">
                <h3 className="font-sans font-bold text-lg text-[#191c1d] border-b border-gray-100 pb-3">Timeline & Attachments</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Requested Deadline */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#434655] uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500" /> Requested Deadline
                    </label>
                    <input 
                      type="date" 
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      onBlur={() => {
                        const fieldErrors = validateForm({
                          deadline: { value: deadline, validators: [validateDeadline] }
                        });
                        setErrors(prev => [...prev.filter(e => e.field !== 'deadline'), ...fieldErrors]);
                      }}
                      className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0037b0]"
                    />
                    {getFieldError('deadline') && (
                      <p className="text-[10px] text-red-600">{getFieldError('deadline')}</p>
                    )}
                  </div>

                  {/* Priority Indicator */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#434655] uppercase tracking-wider">Inquiry Priority Level</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPriority('STANDARD')}
                        className={`py-2 rounded text-xs font-bold border transition-all ${
                          priority === 'STANDARD'
                            ? 'bg-blue-50 border-[#0037b0] text-[#0037b0]'
                            : 'bg-white border-[#c4c5d7] text-[#434655] hover:bg-gray-50'
                        }`}
                      >
                        Standard (5-7 days)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority('URGENT')}
                        className={`py-2 rounded text-xs font-bold border transition-all ${
                          priority === 'URGENT'
                            ? 'bg-[#ffdad6] border-[#ba1a1a] text-[#93000a]'
                            : 'bg-white border-[#c4c5d7] text-[#434655] hover:bg-gray-50'
                        }`}
                      >
                        Urgent (Rush order)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stepper Footer Action Buttons */}
            <div className="flex justify-between border-t border-gray-100 pt-6 mt-6">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="px-5 py-2 border border-[#c4c5d7] text-[#434655] font-semibold text-sm rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous Step</span>
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    const stepErrors = validateStep(step);
                    setErrors(stepErrors);
                    if (stepErrors.length > 0) return;
                    setStep(step + 1);
                  }}
                  className="px-5 py-2 bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-semibold text-sm rounded-lg flex items-center gap-1.5 transition-all shadow-md ml-auto"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-semibold text-sm rounded-lg flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50 ml-auto"
                >
                  <span>{submitting ? 'Submitting...' : 'Submit Inquiry'}</span>
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Right Column: References & Informational Guides */}
        <div className="space-y-6">
          {/* Submission Guidelines */}
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm space-y-4">
            <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#0037b0]" /> Submission Guidelines
            </h4>
            <ul className="space-y-3 text-xs text-[#434655] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#0037b0]">1.</span>
                <span>Frame inquiries strictly within committee legal jurisdiction. Broad or unfocused prompts will be returned for revision.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#0037b0]">2.</span>
                <span>Attach existing reference documentation, drafts, or charts where possible to expedite research pipelines.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[#0037b0]">3.</span>
                <span>Standard priority requests take 5-7 business days. Urgent inquiries are flagged for immediate director desk assessment.</span>
              </li>
            </ul>
          </div>

          {/* Privacy Notice Card */}
          <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm space-y-3">
            <h4 className="font-sans font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-800" /> Privilege & Privacy Notice
            </h4>
            <p className="text-xs text-[#434655] leading-relaxed">
              All inquiries, statistical requests, and draft documentations are held under strict parliamentary privilege. Content is encrypted and accessible only to authorized staff.
            </p>
          </div>

          {/* Assistance contact */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 text-center space-y-2">
            <HelpCircle className="w-8 h-8 text-[#0037b0] mx-auto" />
            <h5 className="text-xs font-bold text-[#0039b5]">Need technical assistance?</h5>
            <p className="text-[10px] text-gray-600">Call the parliamentary research helpdesk at extension <span className="font-bold">+4412</span>.</p>
          </div>
        </div>

      </div>
    </div>
  );
};
