import React, { useState, useEffect, useCallback } from "react";
import {
  getTeams,
  createTeam,
  updateTeam,
  addTeamMembers,
  removeTeamMember,
  deactivateTeam,
  getUsers,
} from "../lib/api";
import { useToast } from "../lib/toast";
import { useApp } from "../context/AppContext";
import {
  Users,
  Plus,
  Loader2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Check,
  Search,
  ChevronDown,
  History,
} from "lucide-react";

const ACTIVE_STATUSES = [
  "SUBMITTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "DRAFT_SUBMITTED",
  "REVISION_REQUESTED",
  "REVISED",
];

interface TeamForm {
  id?: string;
  name: string;
  description: string;
  leadId: string;
  memberIds: string[];
}

export const TeamsView: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TeamForm>({
    name: "",
    description: "",
    leadId: "",
    memberIds: [],
  });
  const [busy, setBusy] = useState(false);
  const [managingTeam, setManagingTeam] = useState<any | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [addCandidates, setAddCandidates] = useState<any[]>([]);
  const [deactivatingTeam, setDeactivatingTeam] = useState<any | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const { toast } = useToast();
  const { requests } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "members" | "load">("name");
  const [showInactive, setShowInactive] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTeams({ includeInactive: true });
      setTeams(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setTeams([]);
      setError(err?.message || "Failed to load teams. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOfficers = useCallback(async () => {
    try {
      const data = await getUsers({ role: "RESEARCH_OFFICER" });
      setOfficers(Array.isArray(data) ? data : []);
    } catch {
      /* ignore — member picker is best-effort */
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchOfficers();
  }, [fetchTeams, fetchOfficers]);

  const openCreate = () => {
    setForm({ name: "", description: "", leadId: "", memberIds: [] });
    setFormOpen(true);
  };

  const openEdit = (team: any) => {
    setForm({
      id: team.id,
      name: team.name,
      description: team.description || "",
      leadId: team.leadId || "",
      memberIds: (team.members || []).map((m: any) => m.userId),
    });
    setFormOpen(true);
  };

  const toggleMember = (id: string) => {
    setForm((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((x) => x !== id)
        : [...prev.memberIds, id],
    }));
  };

  const handleSubmitForm = async () => {
    if (!form.name.trim()) {
      toast.error("Team name is required");
      return;
    }
    setBusy(true);
    try {
      if (form.id) {
        await updateTeam(form.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          leadId: form.leadId || undefined,
        });
        toast.success("Team updated");
      } else {
        await createTeam({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          leadId: form.leadId || undefined,
          memberIds: form.memberIds,
        });
        toast.success("Team created");
      }
      setFormOpen(false);
      await fetchTeams();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save team");
    } finally {
      setBusy(false);
    }
  };

  const openManage = async (team: any) => {
    setManagingTeam(team);
    setMemberSearch("");
    setAddCandidates(
      officers.filter(
        (o) => !(team.members || []).some((m: any) => m.userId === o.id),
      ),
    );
  };

  const handleAddMember = async (officer: any) => {
    if (!managingTeam) return;
    setBusy(true);
    try {
      const updated = await addTeamMembers(managingTeam.id, [officer.id]);
      toast.success(`${officer.firstName} ${officer.lastName} added`);
      setManagingTeam(updated || null);
      setAddCandidates((prev) => prev.filter((o) => o.id !== officer.id));
      await fetchTeams();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (member: any) => {
    if (!managingTeam) return;
    setBusy(true);
    try {
      await removeTeamMember(managingTeam.id, member.userId);
      toast.success("Member removed");
      setManagingTeam((prev: any) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter(
                (m: any) => m.userId !== member.userId,
              ),
            }
          : null,
      );
      const removed = officers.find((o) => o.id === member.userId);
      if (removed) setAddCandidates((prev) => [...prev, removed]);
      await fetchTeams();
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove member");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivatingTeam) return;
    setDeactivating(true);
    try {
      await deactivateTeam(deactivatingTeam.id);
      toast.success("Team deactivated");
      setDeactivatingTeam(null);
      await fetchTeams();
    } catch (err: any) {
      toast.error(err?.message || "Failed to deactivate team");
    } finally {
      setDeactivating(false);
    }
  };

  const filteredCandidates = addCandidates.filter((o) => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return true;
    return `${o.firstName} ${o.lastName}`.toLowerCase().includes(q);
  });

  const teamWorkload = (teamId: string) => {
    const teamRequests = requests.filter((r: any) => r.teamId === teamId);
    const active = teamRequests.filter((r: any) => ACTIVE_STATUSES.includes(r.status as string));
    const now = new Date().getTime();
    const overdue = active.filter((r: any) => new Date(r.deadline).getTime() < now);
    return { total: teamRequests.length, active: active.length, overdue: overdue.length };
  };

  const visibleTeams = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = teams.filter((t) => {
      const haystack = [
        t.name,
        t.description || "",
        t.lead ? `${t.lead.firstName} ${t.lead.lastName}` : "",
        ...(t.members || []).map((m: any) => `${m.user?.firstName || ""} ${m.user?.lastName || ""}`),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus = showInactive || t.isActive !== false;
      return matchesSearch && matchesStatus;
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortBy === "load") return teamWorkload(b.id).active - teamWorkload(a.id).active;
      if (sortBy === "members") return (b.members?.length || 0) - (a.members?.length || 0);
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [teams, searchQuery, sortBy, showInactive, requests]);

  const activeTeamCount = teams.filter((t) => t.isActive !== false).length;
  const inactiveTeamCount = teams.length - activeTeamCount;
  const memberCount = teams.reduce((n: number, t: any) => n + (t.members?.length || 0), 0);

  const handleRestore = async (team: any) => {
    setBusy(true);
    try {
      await updateTeam(team.id, { isActive: true });
      toast.success(`"${team.name}" reactivated`);
      await fetchTeams();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reactivate team");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">
            Research Teams
          </h2>
          <p className="font-sans text-sm text-[#434655] mt-1">
            Create and manage research teams, leads, and membership.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow flex items-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Team
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg px-4 py-3 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by team, lead, or member name…"
            className="w-full pl-9 pr-8 py-2 bg-white border border-[#c4c5d7] rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">
            {activeTeamCount} active · {inactiveTeamCount} inactive · {memberCount} officers
          </span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none bg-white border border-[#c4c5d7] rounded-lg pl-3 pr-8 py-2 text-xs font-semibold text-[#191c1d] outline-none focus:ring-1 focus:ring-[#0037b0] cursor-pointer"
            >
              <option value="name">Sort: Name</option>
              <option value="members">Sort: Members</option>
              <option value="load">Sort: Active Load</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              showInactive
                ? "bg-[#dce1ff] text-[#0037b0] border-[#0037b0]/30"
                : "bg-white text-gray-500 border-[#c4c5d7] hover:bg-gray-50"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Show inactive
          </button>
        </div>
      </div>

      {/* Team grid */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-xs font-semibold">Loading teams...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-gray-600 font-semibold">{error}</p>
          <button
            onClick={fetchTeams}
            className="flex items-center gap-1.5 text-xs font-bold text-[#0037b0] hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : teams.length === 0 ? (
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-16 text-center space-y-3">
          <Users className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-bold text-gray-700">No teams created yet</p>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Create your first research team to assign work to a group of
            officers in one go.
          </p>
          <button
            onClick={openCreate}
            className="mt-2 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
          >
            Create Team
          </button>
        </div>
      ) : visibleTeams.length === 0 ? (
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-16 text-center space-y-3">
          <Search className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-bold text-gray-700">No teams match your search</p>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try a different keyword{inactiveTeamCount > 0 && !showInactive ? ", or reveal deactivated teams." : "."}
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-2 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleTeams.map((team) => {
            const members = team.members || [];
            const inactive = team.isActive === false;
            const load = teamWorkload(team.id);
            return (
              <div
                key={team.id}
                className={`bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm flex flex-col transition-all hover:border-[#0037b0]/40 ${
                  inactive ? "opacity-70 grayscale-[35%]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${inactive ? "bg-gray-200 text-gray-500" : "bg-[#dce1ff] text-[#001551]"}`}>
                      {team.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-[#191c1d] truncate max-w-44" title={team.name}>
                        {team.name}
                      </h4>
                      {team.lead && (
                        <p className="text-[11px] text-[#434655] truncate max-w-44">
                          Lead: {team.lead.firstName} {team.lead.lastName}
                          <span className="ml-1.5 text-[8px] font-bold uppercase bg-[#dce1ff] text-[#0039b5] px-1 py-0.5 rounded">
                            Lead
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {inactive ? (
                      <button
                        onClick={() => handleRestore(team)}
                        disabled={busy}
                        className="p-1.5 text-[#006b2c] hover:bg-green-50 rounded transition-all cursor-pointer disabled:opacity-40"
                        title="Reactivate Team"
                        aria-label={`Reactivate ${team.name}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(team)}
                          className="p-1.5 text-[#0037b0] hover:bg-blue-50 rounded transition-all cursor-pointer"
                          title="Edit Team"
                          aria-label={`Edit ${team.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeactivatingTeam(team)}
                          className="p-1.5 text-[#ba1a1a] hover:bg-red-50 rounded transition-all cursor-pointer"
                          title="Deactivate Team"
                          aria-label={`Deactivate ${team.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {inactive && (
                  <span className="mt-2 self-start inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                    <History className="w-3 h-3" />
                    Deactivated
                  </span>
                )}

                {team.description && (
                  <p className="mt-3 text-xs text-gray-500 line-clamp-2">
                    {team.description}
                  </p>
                )}

                {/* Workload telemetry */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5 ${
                      load.active > 0 ? "bg-blue-50 text-[#0037b0]" : "bg-gray-50 text-gray-400"
                    }`}
                    title="Requests currently in the pipeline"
                  >
                    <Users className="w-3 h-3" />
                    {load.active} active
                  </span>
                  {load.overdue > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-[9px] font-bold rounded-full px-2 py-0.5 bg-[#ffdad6] text-[#93000a]"
                      title="Pipeline requests past their deadline"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {load.overdue} overdue
                    </span>
                  )}
                </div>

                {/* Member avatar stack */}
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => openManage(team)}
                    className="flex items-center text-xs font-semibold text-[#0037b0] hover:underline cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    Manage Members
                  </button>
                  <div className="flex items-center">
                    {members.slice(0, 4).map((m: any, i: number) => (
                      <div
                        key={m.userId}
                        title={`${m.user?.firstName || ""} ${m.user?.lastName || ""}${team.leadId === m.userId ? " (Lead)" : ""}`}
                        className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold ${
                          team.leadId === m.userId
                            ? "bg-amber-100 text-amber-800"
                            : "bg-[#dce1ff] text-[#001551]"
                        } ${i > 0 ? "-ml-2" : ""}`}
                      >
                        {m.user?.initials ||
                          `${(m.user?.firstName || "")[0] || ""}${(m.user?.lastName || "")[0] || ""}`}
                      </div>
                    ))}
                    {members.length > 4 && (
                      <div
                        className="w-7 h-7 rounded-full bg-[#e9eaf1] border-2 border-white flex items-center justify-center text-[8px] font-bold text-[#191c1d] -ml-2"
                        title={members
                          .map((m: any) => `${m.user?.firstName || ""} ${m.user?.lastName || ""}`)
                          .join("\n")}
                      >
                        +{members.length - 4}
                      </div>
                    )}
                    {members.length === 0 && (
                      <span className="text-[10px] text-gray-400 italic">
                        No members
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-[11px] font-semibold text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </span>
                  <span title="Historical request count">{team._count?.requests || 0} requests</span>
                  <span title="Assignments made to this team">{team._count?.assignments || 0} assignments</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[8vh] px-4 overflow-y-auto"
          onClick={() => {
            if (!busy) setFormOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={form.id ? "Edit team" : "Create team"}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#0037b0] flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {form.id ? "Edit Team" : "Create Team"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {form.id
                    ? "Update the team details below."
                    : "Set up a new research team."}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!busy) setFormOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label="Close"
                disabled={busy}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Team Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Economic Research Unit"
                  className="w-full bg-white border border-[#c4c5d7] rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#0037b0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="What does this team focus on?"
                  rows={3}
                  className="w-full bg-white border border-[#c4c5d7] rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#0037b0] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Team Lead
                </label>
                <select
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className="w-full bg-white border border-[#c4c5d7] rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#0037b0] appearance-none cursor-pointer"
                >
                  <option value="">Select lead…</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.firstName} {o.lastName}
                      {o.title ? ` — ${o.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {!form.id && (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">
                    Members ({form.memberIds.length} selected)
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-[#c4c5d7] rounded-lg divide-y divide-gray-100">
                    {officers.length === 0 && (
                      <p className="px-4 py-4 text-center text-xs text-gray-400 italic">
                        No research officers available
                      </p>
                    )}
                    {officers.map((o) => {
                      const checked = form.memberIds.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleMember(o.id)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                            checked ? "bg-[#dce1ff]/40" : "hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              checked
                                ? "bg-[#0037b0] border-[#0037b0]"
                                : "border-[#c4c5d7]"
                            }`}
                          >
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="font-semibold text-[#191c1d]">
                            {o.firstName} {o.lastName}
                          </span>
                          {o.title && (
                            <span className="text-gray-400 truncate">
                              {o.title}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setFormOpen(false)}
                  disabled={busy}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitForm}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0037b0] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {busy ? "Saving…" : form.id ? "Save Changes" : "Create Team"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Members Modal */}
      {managingTeam && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[8vh] px-4 overflow-y-auto"
          onClick={() => setManagingTeam(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Manage members of ${managingTeam.name}`}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-[#0037b0] flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {managingTeam.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Manage team membership
                </p>
              </div>
              <button
                onClick={() => setManagingTeam(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Current members */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Current Members ({(managingTeam.members || []).length})
                </label>
                {(managingTeam.members || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    No members yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(managingTeam.members || []).map((m: any) => (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between bg-[#f3f4f5] border border-[#c4c5d7] rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#dce1ff] flex items-center justify-center text-[8px] font-bold text-[#001551] shrink-0">
                            {m.user?.initials || "??"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#191c1d] truncate">
                              {m.user?.firstName} {m.user?.lastName}
                            </p>
                            {managingTeam.leadId === m.userId && (
                              <span className="text-[9px] font-bold text-[#0037b0] uppercase tracking-wider">
                                Lead
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(m)}
                          disabled={busy}
                          className="p-1.5 text-[#ba1a1a] hover:bg-red-50 rounded transition-all cursor-pointer disabled:opacity-40"
                          title="Remove member"
                          aria-label={`Remove ${m.user?.firstName} ${m.user?.lastName}`}
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add candidates */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2">
                  Add Members
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search officers…"
                    className="w-full pl-9 pr-4 py-2 bg-white border border-[#c4c5d7] rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
                  />
                </div>
                {filteredCandidates.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    {addCandidates.length === 0
                      ? "All available officers are already members"
                      : "No matching officers"}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-[#c4c5d7] rounded-lg divide-y divide-gray-100">
                    {filteredCandidates.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleAddMember(o)}
                        disabled={busy}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <span className="font-semibold text-[#191c1d]">
                          {o.firstName} {o.lastName}
                        </span>
                        <span className="flex items-center gap-1 text-[#0037b0] font-bold">
                          <UserPlus className="w-3.5 h-3.5" /> Add
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm modal */}
      {deactivatingTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            if (!deactivating) setDeactivatingTeam(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Deactivate ${deactivatingTeam.name}`}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-[#ba1a1a] flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Deactivate Team
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600">
                Deactivate <strong>{deactivatingTeam.name}</strong>? It will no
                longer appear in assignment lists.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setDeactivatingTeam(null)}
                  disabled={deactivating}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeactivate}
                  disabled={deactivating}
                  className="px-4 py-2 bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deactivating ? "Deactivating…" : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
