import prisma from "./prisma.js";
import { lookupByIdOrNumber } from "./requestUtils.js";

/**
 * Single source of truth for "may this user see/touch this research request?".
 *
 * Every read and write route that touches a request, a report, a review comment
 * or an attachment must funnel through here. Previously three divergent copies
 * of this logic existed (uploads.ts, reports.ts, and an inline filter in
 * requests.ts) and five routes had no check at all.
 *
 * The rule set:
 *   - ADMIN sees everything.
 *   - The submitting MP sees their own requests.
 *   - A RESEARCH_OFFICER sees a request when they are the named officer, hold
 *     an ACTIVE assignment, or belong to the assigned team.
 *
 * "Active" deliberately excludes declined and superseded assignments: an
 * officer who walked away, or who was replaced during a reassignment, must not
 * retain visibility into a request they no longer work on.
 *
 * The named-officer, assignment and team grants are OFFICER grants only. An MP
 * is limited to requests they submitted themselves; otherwise an MP who happened
 * to be listed on a team, or named as `assignedOfficerId` by bad data, would be
 * handed another member's confidential request.
 */

export interface AccessActor {
  userId: string;
  role: string;
}

/** Minimal shape of a request as loaded by `loadRequestForAccess`. */
export interface AccessRequest {
  id: string;
  submitterId: string | null;
  assignedOfficerId: string | null;
  assignments: { assignedToId: string | null; declinedAt: Date | null; supersededAt: Date | null }[];
  team: { members: { userId: string }[] } | null;
}

/**
 * The exact select needed by `canAccessRequest`. Spread this into any query
 * that then needs to make an access decision.
 */
export const accessRequestSelect = {
  id: true,
  submitterId: true,
  assignedOfficerId: true,
  assignments: { select: { assignedToId: true, declinedAt: true, supersededAt: true } },
  team: { select: { members: { select: { userId: true } } } },
} as const;

/** Pure predicate. Kept separate from the DB so it is unit-testable. */
export function canAccessRequest(request: AccessRequest, actor: AccessActor): boolean {
  if (actor.role === "ADMIN") return true;

  // An MP's access is exactly "requests I submitted". Nothing else may widen it.
  if (actor.role === "MP") {
    return Boolean(request.submitterId) && request.submitterId === actor.userId;
  }

  if (request.assignedOfficerId === actor.userId) return true;

  const hasActiveAssignment = request.assignments.some(
    (a) => a.assignedToId === actor.userId && !a.declinedAt && !a.supersededAt,
  );
  if (hasActiveAssignment) return true;

  if (request.team?.members.some((m) => m.userId === actor.userId)) return true;

  return false;
}

/**
 * Prisma `where` fragment selecting the requests an actor may see, for queries
 * that reach requests through a relation (a share, a report, an activity entry)
 * and therefore cannot be filtered after the fact.
 *
 * Expressed as a filter so the database does the work — loading every row and
 * discarding it in JS was both slow and a silent leak if the filter was ever
 * skipped.
 */
export function requestScopeFor(actor: AccessActor): Record<string, unknown> {
  if (actor.role === "ADMIN") return {};

  if (actor.role === "MP") {
    return { submitterId: actor.userId };
  }

  return {
    OR: [
      { assignedOfficerId: actor.userId },
      {
        assignments: {
          some: {
            assignedToId: actor.userId,
            declinedAt: null,
            supersededAt: null,
          },
        },
      },
      { team: { members: { some: { userId: actor.userId } } } },
    ],
  };
}

/**
 * Ids of every request the actor may access. Used to scope polymorphic
 * activity-log entries, which carry only a free-text `entityType`/`entityId`
 * pair and no relation to filter on.
 */
export async function accessibleRequestIds(actor: AccessActor): Promise<string[]> {
  if (actor.role === "ADMIN") {
    return [];
  }

  const requests = await prisma.researchRequest.findMany({
    where: requestScopeFor(actor),
    select: { id: true },
  });
  return requests.map((r: { id: string }) => r.id);
}

/**
 * Scope for the global activity log.
 *
 * ActivityLog is polymorphic (`entityType` + `entityId`, no relation), so a
 * non-admin must see their own actions plus actions on requests they work on —
 * and nothing else. Returning `undefined` means "no restriction", i.e. admin.
 */
export async function activityScopeFor(actor: AccessActor): Promise<Record<string, unknown> | undefined> {
  if (actor.role === "ADMIN") return undefined;

  const requestIds = await accessibleRequestIds(actor);
  return {
    OR: [
      { authorId: actor.userId },
      { entityType: "ResearchRequest", entityId: { in: requestIds } },
    ],
  };
}

/**
 * Load a request by id-or-number with the fields required for an access
 * decision. Returns null when the request does not exist.
 */
export async function loadRequestForAccess(
  idOrNumber: string,
): Promise<AccessRequest | null> {
  return prisma.researchRequest.findUnique({
    where: lookupByIdOrNumber(idOrNumber),
    select: accessRequestSelect,
  }) as Promise<AccessRequest | null>;
}

/**
 * Resolve a request and confirm the actor may access it. Returns the request
 * when access is allowed, or null when it is missing OR forbidden. Callers
 * respond with 404 for null so that probing for the existence of a foreign
 * request is not distinguishable from probing for a nonexistent one.
 */
export async function authorizeRequest(
  idOrNumber: string,
  actor: AccessActor,
): Promise<AccessRequest | null> {
  const request = await loadRequestForAccess(idOrNumber);
  if (!request) return null;
  return canAccessRequest(request, actor) ? request : null;
}
