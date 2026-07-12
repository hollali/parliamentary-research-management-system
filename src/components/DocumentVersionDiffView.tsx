import React, { useState, useEffect } from 'react';
import { getReportVersions, compareReportVersions } from '../lib/api';
import { 
  GitCompare, 
  ChevronDown, 
  Clock, 
  FileText,
  ArrowLeft,
  ArrowRight,
  Equal
} from 'lucide-react';

interface ReportVersion {
  id: string;
  reportId: string;
  version: number;
  content: string | null;
  filePath: string | null;
  fileType: string;
  fileSize: number | null;
  notes: string | null;
  createdAt: string;
}

interface DocumentVersionDiffProps {
  reportId: string;
  onBack: () => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  lineNum?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];
  
  // Simple line-by-line diff using LCS approach
  const m = oldLines.length;
  const n = newLines.length;
  
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // Backtrack to find diff
  let i = m, j = n;
  const tempResult: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      tempResult.unshift({ type: 'unchanged', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempResult.unshift({ type: 'added', text: newLines[j - 1] });
      j--;
    } else {
      tempResult.unshift({ type: 'removed', text: oldLines[i - 1] });
      i--;
    }
  }
  
  return tempResult;
}

export const DocumentVersionDiffView: React.FC<DocumentVersionDiffProps> = ({ reportId, onBack }) => {
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [v1, setV1] = useState<number>(0);
  const [v2, setV2] = useState<number>(0);
  const [diff, setDiff] = useState<DiffLine[]>([]);
  const [comparing, setComparing] = useState(false);
  const [stats, setStats] = useState({ added: 0, removed: 0, unchanged: 0 });

  useEffect(() => {
    getReportVersions(reportId)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setVersions(data);
          setV1(data.length > 1 ? data[1].version : data[0].version);
          setV2(data[0].version);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [reportId]);

  useEffect(() => {
    if (v1 && v2 && v1 !== v2) {
      setComparing(true);
      compareReportVersions(reportId, v1, v2)
        .then((data) => {
          if (data?.versionA && data?.versionB) {
            const oldText = data.versionA.content || '(No text content)';
            const newText = data.versionB.content || '(No text content)';
            const d = computeDiff(oldText, newText);
            setDiff(d);
            setStats({
              added: d.filter(l => l.type === 'added').length,
              removed: d.filter(l => l.type === 'removed').length,
              unchanged: d.filter(l => l.type === 'unchanged').length,
            });
          }
          setComparing(false);
        })
        .catch(() => setComparing(false));
    }
  }, [reportId, v1, v2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#0037b0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Version Diff</h2>
          <p className="font-sans text-sm text-[#434655] mt-0.5">Compare changes between report versions.</p>
        </div>
      </div>

      {/* Version selectors */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Old Version:</span>
          <div className="relative">
            <select
              value={v1}
              onChange={(e) => setV1(parseInt(e.target.value))}
              className="bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-semibold text-gray-700 appearance-none cursor-pointer"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version}>v{v.version} — {new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase">New Version:</span>
          <div className="relative">
            <select
              value={v2}
              onChange={(e) => setV2(parseInt(e.target.value))}
              className="bg-white border border-[#c4c5d7] rounded-md pl-3 pr-8 py-1.5 text-xs font-semibold text-gray-700 appearance-none cursor-pointer"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.version}>v{v.version} — {new Date(v.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-bold text-green-600">+{stats.added} added</span>
          <span className="text-[10px] font-bold text-red-600">-{stats.removed} removed</span>
          <span className="text-[10px] font-bold text-gray-400">{stats.unchanged} unchanged</span>
        </div>
      </div>

      {/* Diff display */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
        {comparing ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-[#0037b0] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : diff.length > 0 ? (
          <div className="font-mono text-xs max-h-[600px] overflow-y-auto">
            {diff.map((line, i) => (
              <div
                key={i}
                className={`flex border-b border-gray-50 ${
                  line.type === 'added' ? 'bg-green-50' :
                  line.type === 'removed' ? 'bg-red-50' :
                  ''
                }`}
              >
                <span className={`w-8 text-right pr-2 py-0.5 text-[10px] shrink-0 ${
                  line.type === 'added' ? 'text-green-400' :
                  line.type === 'removed' ? 'text-red-400' :
                  'text-gray-300'
                }`}>
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </span>
                <span className="py-0.5 px-2 flex-1 whitespace-pre-wrap break-words">{line.text || ' '}</span>
              </div>
            ))}
          </div>
        ) : v1 === v2 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Equal className="w-6 h-6 mb-2" />
            <p className="text-xs">Select two different versions to compare.</p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <p className="text-xs">No content available for comparison.</p>
          </div>
        )}
      </div>

      {/* Version history */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm">
        <div className="px-6 py-3 border-b border-gray-100">
          <h3 className="font-sans font-bold text-sm text-[#191c1d]">Version History</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {versions.map((v) => (
            <div key={v.id} className="px-6 py-3 flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-bold text-[#0037b0] shrink-0">
                v{v.version}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900">{v.notes || `Version ${v.version}`}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {new Date(v.createdAt).toLocaleString('en-US', {
                    month: 'short', day: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                  {v.fileSize && <span className="ml-2">• {(v.fileSize / 1024).toFixed(1)} KB</span>}
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">{v.fileType}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
