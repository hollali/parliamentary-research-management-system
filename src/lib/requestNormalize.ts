import { ResearchRequest } from "../types";

export function formatDeadline(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function normalizeFetchedRequest(
  data: any,
  fallbackId: string,
): ResearchRequest {
  return {
    id: data?.requestNumber || fallbackId,
    title: data?.title || "",
    topic: data?.subject || data?.title || "",
    category: data?.category?.name || data?.category || "",
    committeeId: data?.committeeId || data?.category?.id || null,
    committeeName: data?.category?.name || data?.committee?.name || null,
    requestingOffice: data?.requestingOffice ?? null,
    member: data?.submitter
      ? `${data.submitter.firstName} ${data.submitter.lastName}`
      : "",
    submitterId: data?.submitterId || data?.submitter?.id || null,
    assignedOfficerId: data?.assignedOfficerId || null,
    assignedOfficerName: data?.officer
      ? `${data.officer.firstName} ${data.officer.lastName}`
      : (data?.assignedOfficerName ?? null),
    teamId: data?.teamId || null,
    teamName: data?.team?.name || null,
    status: data?.status || "SUBMITTED",
    priority: data?.priority || "STANDARD",
    dateSubmitted: data?.dateSubmitted
      ? formatDeadline(data.dateSubmitted)
      : "",
    deadline: formatDeadline(data?.deadline),
    description: data?.description || "",
    language: data?.language || "English",
    draftVersion: data?.reports?.[0]?.version || data?.draftVersion || 1,
    attachments: [],
    comments: (data?.comments || []).map((c: any) => ({
      id: c.id,
      userName: c.author
        ? `${c.author.firstName} ${c.author.lastName}`
        : "Unknown",
      userInitials: c.author?.initials || "??",
      role: c.author?.role || "Unknown",
      time: new Date(c.createdAt).toLocaleString(),
      text: c.text,
      section: c.section || undefined,
      highlightedText: c.highlightedText || undefined,
      resolved: c.resolved,
    })),
    content: data?.reports?.[0]?.content || "",
    reportId: data?.reports?.[0]?.id || null,
    memberConfirmedAt: data?.memberConfirmedAt || null,
    memberConfirmationNote: data?.memberConfirmationNote ?? null,
    assignedOfficers: (data?.assignments || [])
      .filter((a: any) => a.assignedTo && !a.declinedAt && !a.supersededAt)
      .map((a: any) => ({
        id: a.assignedTo?.id || "",
        firstName: a.assignedTo?.firstName || "",
        lastName: a.assignedTo?.lastName || "",
        initials: a.assignedTo?.initials || "",
      })),
    declinedAssignments: (data?.assignments || [])
      .filter((a: any) => a.assignedTo && a.declinedAt)
      .map((a: any) => ({
        id: a.assignedTo?.id || "",
        firstName: a.assignedTo?.firstName || "",
        lastName: a.assignedTo?.lastName || "",
        initials: a.assignedTo?.initials || "",
        reason: a.declineReason || null,
      })),
    previousOfficers: (data?.assignments || [])
      .filter((a: any) => a.assignedTo && a.supersededAt && !a.declinedAt)
      .map((a: any) => ({
        id: a.assignedTo?.id || "",
        firstName: a.assignedTo?.firstName || "",
        lastName: a.assignedTo?.lastName || "",
        initials: a.assignedTo?.initials || "",
        reason: a.declineReason || null,
      })),
  };
}
