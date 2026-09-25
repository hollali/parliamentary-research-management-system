import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useToast } from "../lib/toast";
import { useDialogA11y } from "../lib/useDialogA11y";
import { getOfficers, getTeams, getRequest } from "../lib/api";
import {
  X,
  UserPlus,
  Users,
  Calendar,
  StickyNote,
  Send,
  Check,
  RefreshCw,
  Pencil,
  UserCheck,
} from "lucide-react";

type AssignAction = "assign" | "reassign" | "add";

interface AssignModalProps {
  requestId: string;
  requestTitle: string;
  onClose: () => void;
}

export const AssignModal: React.FC<AssignModalProps> = ({
  requestId,
  requestTitle,
  onClose,
}) => {
  const { assignRequest } = useApp();

  const { toast } = useToast();
  const [officers, setOfficers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [actionMode, setActionMode] = useState<AssignAction>("assign");
  const [assignMode, setAssignMode] = useState<"officer" | "team">("officer");
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [currentOfficers, setCurrentOfficers] = useState<string[]>([]);
  const [currentOfficerIds, setCurrentOfficerIds] = useState<string[]>([]);
  const [isRequestAssigned, setIsRequestAssigned] = useState(false);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getOfficers()
      .then((d) => {
        if (Array.isArray(d)) setOfficers(d);
      })
      .catch(() => toast.error("Failed to load officers"));
    getTeams()
      .then((d) => {
        if (Array.isArray(d)) setTeams(d);
      })
      .catch(() => toast.error("Failed to load teams"));
    getRequest(requestId)
      .then((req: any) => {
        if (!req) return;
        const ids: string[] = [];
        const names: string[] = [];
        if (req.officer?.id) {
          ids.push(req.officer.id);
          names.push(`${req.officer.firstName} ${req.officer.lastName}`);
        }
        for (const a of req.assignments || []) {
          if (a.assignedTo && !a.declinedAt && !a.supersededAt) {
            if (a.assignedTo.id !== req.assignedOfficerId) {
              names.push(`${a.assignedTo.firstName} ${a.assignedTo.lastName}`);
            }
            if (!ids.includes(a.assignedTo.id)) ids.push(a.assignedTo.id);
          }
        }
        setCurrentOfficerIds(ids);
        setCurrentOfficers(names);
        setIsRequestAssigned(!!req.officer?.id);
        if (req.officer?.id) {
          setActionMode("reassign");
        }
      })
      .catch(() => {
        /* ignore — current officers are best-effort */
      });
  }, [requestId]);

  const overlayRef = useDialogA11y<HTMLDivElement>({ onClose });

  const toggleOfficer = (id: string) => {
    if (actionMode === "reassign") {
      setSelectedOfficerIds([id]);
      return;
    }
    setSelectedOfficerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    if (
      actionMode === "assign" &&
      assignMode === "officer" &&
      selectedOfficerIds.length === 0
    ) {
      toast.error("Please select at least one research officer");
      return;
    }
    if (actionMode === "assign" && assignMode === "team" && !selectedTeamId) {
      toast.error("Please select a team");
      return;
    }
    if (
      actionMode === "reassign" &&
      assignMode === "officer" &&
      selectedOfficerIds.length !== 1
    ) {
      toast.error("Please select exactly one officer to reassign to");
      return;
    }
    if (actionMode === "reassign" && assignMode === "team" && !selectedTeamId) {
      toast.error("Please select a team to reassign to");
      return;
    }
    if (actionMode === "add" && selectedOfficerIds.length === 0) {
      toast.error("Please select at least one officer to add");
      return;
    }
    if (!deadline) {
      toast.error("Please set a deadline");
      return;
    }

    setSubmitting(true);
    try {
      await assignRequest(
        requestId,
        assignMode === "officer" ? selectedOfficerIds : undefined,
        assignMode === "team" ? selectedTeamId : undefined,
        new Date(deadline).toISOString(),
        notes || undefined,
        actionMode,
      );
      const label =
        assignMode === "officer"
          ? selectedOfficerIds
              .map((id) => {
                const off = officers.find((o) => o.id === id);
                return off ? `${off.firstName} ${off.lastName}` : "";
              })
              .filter(Boolean)
              .join(", ")
          : teams.find((t) => t.id === selectedTeamId)?.name;
      const verb =
        actionMode === "reassign"
          ? "Reassigned to"
          : actionMode === "add"
            ? "Added"
            : "Assigned to";
      toast.success(`${verb} ${label}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Assign research officer for ${requestTitle}`}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-[#0037b0] flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Assign Research
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              {requestTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Action Mode */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              {isRequestAssigned ? "Change Assignment" : "Action"}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {!isRequestAssigned && (
                <button
                  onClick={() => {
                    setActionMode("assign");
                    setSelectedOfficerIds([]);
                  }}
                  aria-pressed={actionMode === "assign"}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                    actionMode === "assign"
                      ? "bg-[#0037b0] text-white border-[#0037b0]"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]"
                  }`}
                  title="Assign a new officer or team (initial assignment)"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign
                </button>
              )}
              {isRequestAssigned && (
                <>
                  <button
                    onClick={() => {
                      setActionMode("reassign");
                      setSelectedOfficerIds([]);
                    }}
                    aria-pressed={actionMode === "reassign"}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      actionMode === "reassign"
                        ? "bg-[#0037b0] text-white border-[#0037b0]"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]"
                    }`}
                    title="Replace the current officer with a new one"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Reassign
                  </button>
                  <button
                    onClick={() => {
                      setActionMode("add");
                      setAssignMode("officer");
                      setSelectedOfficerIds([]);
                    }}
                    aria-pressed={actionMode === "add"}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                      actionMode === "add"
                        ? "bg-[#0037b0] text-white border-[#0037b0]"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]"
                    }`}
                    title="Add an officer while keeping the current one"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Add Officer
                  </button>
                </>
              )}
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              {actionMode === "assign" &&
                "Initial assignment of an officer or research team."}
              {actionMode === "reassign" &&
                "Removes the current assignee and transfers ownership to the selected officer or team. Both are notified."}
              {actionMode === "add" &&
                "Keeps the current officer and adds one or more officers with full access to the request."}
            </p>
          </div>

          {actionMode !== "assign" && currentOfficers.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" />
              <p className="text-[11px] text-amber-800 font-semibold">
                Current officer(s): {currentOfficers.join(", ")}
              </p>
            </div>
          )}

          {/* Mode Toggle — for initial assignment and reassignment */}
          {(actionMode === "assign" || actionMode === "reassign") && (
            <div className="flex gap-2">
              <button
                onClick={() => setAssignMode("officer")}
                aria-pressed={assignMode === "officer"}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                  assignMode === "officer"
                    ? "bg-[#0037b0] text-white border-[#0037b0]"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Officers{" "}
                {selectedOfficerIds.length > 0 &&
                  `(${selectedOfficerIds.length})`}
              </button>
              <button
                onClick={() => setAssignMode("team")}
                aria-pressed={assignMode === "team"}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                  assignMode === "team"
                    ? "bg-[#0037b0] text-white border-[#0037b0]"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-[#0037b0] hover:text-[#0037b0]"
                }`}
              >
                <Users className="w-4 h-4" />
                Research Team
              </button>
            </div>
          )}

          {/* Officer Multi-Select */}
          {assignMode === "officer" && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                {actionMode === "reassign"
                  ? "Select New Officer"
                  : actionMode === "add"
                    ? "Select Officers to Add"
                    : "Select Officers"}{" "}
                {selectedOfficerIds.length > 0 && (
                  <span className="text-[#0037b0]">
                    ({selectedOfficerIds.length} selected)
                  </span>
                )}
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {officers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 italic">
                    No officers available
                  </div>
                ) : (
                  officers.map((off) => {
                    const isCurrent = currentOfficerIds.includes(off.id);
                    const isSelected = selectedOfficerIds.includes(off.id);
                    return (
                      <button
                        key={off.id}
                        onClick={() => !isCurrent && toggleOfficer(off.id)}
                        disabled={isCurrent}
                        aria-pressed={isSelected}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isCurrent
                            ? "bg-gray-50 opacity-50 cursor-not-allowed"
                            : isSelected
                              ? "bg-[#dce1ff]"
                              : "hover:bg-gray-50 cursor-pointer"
                        }`}
                        title={
                          isCurrent
                            ? actionMode === "reassign"
                              ? "Currently assigned — reassigns must go to a different officer"
                              : "Already assigned to this request"
                            : undefined
                        }
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-[#0037b0] border-[#0037b0]"
                              : isCurrent
                                ? "border-gray-300 bg-gray-100"
                                : "border-gray-300"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                          {isCurrent && (
                            <Check className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#0037b0]/10 flex items-center justify-center text-xs font-bold text-[#0037b0]">
                          {off.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800">
                            {off.firstName} {off.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {off.title || "Research Officer"} &middot;{" "}
                            {off._count?.assignedRequests || 0} active
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide border border-gray-200 rounded-full px-2 py-0.5">
                            Current
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              {selectedOfficerIds.length > 1 && actionMode === "assign" && (
                <p className="text-xs text-gray-500 mt-1.5">
                  First officer (
                  {
                    officers.find((o) => o.id === selectedOfficerIds[0])
                      ?.firstName
                  }
                  ) will be the primary assignee.
                </p>
              )}
              {actionMode === "reassign" && selectedOfficerIds.length === 1 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  {
                    officers.find((o) => o.id === selectedOfficerIds[0])
                      ?.firstName
                  }{" "}
                  will replace the current officer and receive full ownership.
                </p>
              )}
            </div>
          )}

          {/* Team Selection */}
          {assignMode === "team" && (
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">
                Select Team
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {teams.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 italic">
                    No teams created yet
                  </div>
                ) : (
                  teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      aria-pressed={selectedTeamId === team.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        selectedTeamId === team.id
                          ? "bg-[#dce1ff]"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-xs font-bold text-green-700">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">
                          {team.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {team.members?.length || 0} members &middot;{" "}
                          {team._count?.requests || 0} requests
                        </div>
                      </div>
                      {selectedTeamId === team.id && (
                        <div className="w-2 h-2 rounded-full bg-[#0037b0]" />
                      )}
                    </button>
                  ))
                )}
              </div>
              {actionMode === "reassign" && selectedTeamId && (
                <p className="text-xs text-gray-500 mt-1.5">
                  {teams.find((t) => t.id === selectedTeamId)?.name} will
                  replace the current assignee and receive full ownership.
                </p>
              )}
            </div>
          )}

          {/* Deadline */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-600 mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0037b0]/20 focus:border-[#0037b0]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-600 mb-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            {submitting ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
};
