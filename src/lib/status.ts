export const REQUEST_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  DRAFT_SUBMITTED: "Draft Submitted",
  REVISION_REQUESTED: "Revision Requested",
  REVISED: "Revised",
  APPROVED: "Approved",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
  OVERDUE: "Overdue",
};

export function formatRequestStatus(status?: string | null): string {
  if (!status) return "";
  return REQUEST_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}