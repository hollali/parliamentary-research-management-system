import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { getOfficers, getTeams } from '../lib/api';
import { X, UserPlus, Users, Calendar, StickyNote, Send, Check } from 'lucide-react';

interface AssignModalProps {
  requestId: string;
  requestTitle: string;
  onClose: () => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({ requestId, requestTitle, onClose }) => {
  const { assignRequest } = useApp();
  const { toast } = useToast();
  const [officers, setOfficers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [assignMode, setAssignMode] = useState<'officer' | 'team'>('officer');
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getOfficers().then(d => { if (Array.isArray(d)) setOfficers(d); }).catch(() => {});
    getTeams().then(d => { if (Array.isArray(d)) setTeams(d); }).catch(() => {});
  }, []);

  const toggleOfficer = (id: string) => {
    setSelectedOfficerIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (assignMode === 'officer' && selectedOfficerIds.length === 0) {
      toast.error('Please select at least one research officer');
      return;
    }
    if (assignMode === 'team' && !selectedTeamId) {
      toast.error('Please select a team');
      return;
    }
    if (!deadline) {
      toast.error('Please set a deadline');
      return;
    }

    setSubmitting(true);
    try {
      await assignRequest(
        requestId,
        assignMode === 'officer' ? selectedOfficerIds : undefined,
        assignMode === 'team' ? selectedTeamId : undefined,
        new Date(deadline).toISOString(),
        notes || undefined,
      );
      const label = assignMode === 'officer'
        ? selectedOfficerIds.map(id => {
            const off = officers.find(o => o.id === id);
            return off ? `${off.firstName} ${off.lastName}` : '';
          }).filter(Boolean).join(', ')
        : teams.find(t => t.id === selectedTeamId)?.name;
      toast.success(`Assigned to ${label}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#0037b0] flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Assign Research
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{requestTitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setAssignMode('officer')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                assignMode === 'officer'
                  ? 'bg-[#0037b0] text-white border-[#0037b0]'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Officers {selectedOfficerIds.length > 0 && `(${selectedOfficerIds.length})`}
            </button>
            <button
              onClick={() => setAssignMode('team')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                assignMode === 'team'
                  ? 'bg-[#0037b0] text-white border-[#0037b0]'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]'
              }`}
            >
              <Users className="w-4 h-4" />
              Research Team
            </button>
          </div>

          {/* Officer Multi-Select */}
          {assignMode === 'officer' && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                Select Officers {selectedOfficerIds.length > 0 && <span className="text-[#0037b0]">({selectedOfficerIds.length} selected)</span>}
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {officers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 italic">No officers available</div>
                ) : officers.map(off => {
                  const isSelected = selectedOfficerIds.includes(off.id);
                  return (
                    <button
                      key={off.id}
                      onClick={() => toggleOfficer(off.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#dce1ff]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-[#0037b0] border-[#0037b0]' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#0037b0]/10 flex items-center justify-center text-xs font-bold text-[#0037b0]">
                        {off.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{off.firstName} {off.lastName}</div>
                        <div className="text-xs text-gray-500">{off.title || 'Research Officer'} &middot; {off._count?.assignedRequests || 0} active</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedOfficerIds.length > 1 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  First officer ({officers.find(o => o.id === selectedOfficerIds[0])?.firstName}) will be the primary assignee.
                </p>
              )}
            </div>
          )}

          {/* Team Selection */}
          {assignMode === 'team' && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Select Team</label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {teams.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 italic">No teams created yet</div>
                ) : teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                      selectedTeamId === team.id ? 'bg-[#dce1ff]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-xs font-bold text-green-700">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{team.name}</div>
                      <div className="text-xs text-gray-500">
                        {team.members?.length || 0} members &middot; {team._count?.requests || 0} requests
                      </div>
                    </div>
                    {selectedTeamId === team.id && (
                      <div className="w-2 h-2 rounded-full bg-[#0037b0]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0037b0]/20 focus:border-[#0037b0]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
              <StickyNote className="w-3.5 h-3.5" />
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Any specific instructions..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0037b0]/20 focus:border-[#0037b0]"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold bg-[#0037b0] text-white rounded-lg hover:bg-[#002d8f] transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
};
