import { describe, it, expect, vi, beforeEach } from 'vitest';

// The authorization helpers only touch Prisma inside loadRequestForAccess /
// authorizeRequest. canAccessRequest is pure, so it can be exercised directly.
vi.mock('../../server/lib/prisma.js', () => ({
  default: {
    researchRequest: { findUnique: vi.fn() },
  },
}));

import {
  canAccessRequest,
  type AccessActor,
  type AccessRequest,
} from '../../server/lib/authorization';
import prisma from '../../server/lib/prisma';

const OFFICER_ID = 'officer-1';
const SUBMITTER_ID = 'mp-1';
const OTHER_MP_ID = 'mp-2';
const TEAM_ID = 'team-1';
const OTHER_TEAM_ID = 'team-2';

function makeRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: 'req-1',
    submitterId: SUBMITTER_ID,
    assignedOfficerId: OFFICER_ID,
    assignments: [],
    team: { members: [] },
    ...overrides,
  };
}

const admin: AccessActor = { userId: 'admin-1', role: 'ADMIN' };
const submitter: AccessActor = { userId: SUBMITTER_ID, role: 'MP' };
const otherMp: AccessActor = { userId: OTHER_MP_ID, role: 'MP' };
const officer: AccessActor = { userId: OFFICER_ID, role: 'RESEARCH_OFFICER' };
const unrelatedOfficer: AccessActor = { userId: 'officer-9', role: 'RESEARCH_OFFICER' };

describe('canAccessRequest', () => {
  it('grants admins access to every request', () => {
    expect(canAccessRequest(makeRequest(), admin)).toBe(true);
    expect(canAccessRequest(makeRequest({ submitterId: 'x', assignedOfficerId: null }), admin)).toBe(true);
  });

  it('grants the submitting MP access', () => {
    expect(canAccessRequest(makeRequest(), submitter)).toBe(true);
  });

  it('denies a different MP — the core cross-tenant leak', () => {
    expect(canAccessRequest(makeRequest(), otherMp)).toBe(false);
  });

  it('grants the named assigned officer', () => {
    expect(canAccessRequest(makeRequest(), officer)).toBe(true);
  });

  it('denies an officer with no relationship to the request', () => {
    expect(canAccessRequest(makeRequest(), unrelatedOfficer)).toBe(false);
  });

  it('grants an officer holding an active direct assignment', () => {
    const request = makeRequest({
      assignedOfficerId: null,
      assignments: [
        { assignedToId: unrelatedOfficer.userId, declinedAt: null, supersededAt: null },
      ],
    });
    expect(canAccessRequest(request, unrelatedOfficer)).toBe(true);
  });

  it('denies a declined assignment', () => {
    const request = makeRequest({
      assignedOfficerId: null,
      assignments: [
        { assignedToId: unrelatedOfficer.userId, declinedAt: new Date(), supersededAt: null },
      ],
    });
    expect(canAccessRequest(request, unrelatedOfficer)).toBe(false);
  });

  it('denies a superseded assignment, even when a replacement exists', () => {
    const request = makeRequest({
      assignedOfficerId: null,
      assignments: [
        { assignedToId: unrelatedOfficer.userId, declinedAt: null, supersededAt: new Date() },
        { assignedToId: 'officer-2', declinedAt: null, supersededAt: null },
      ],
    });
    expect(canAccessRequest(request, unrelatedOfficer)).toBe(false);
  });

  it('grants a member of the assigned team', () => {
    // `request.team` is the request's own team relation, so anyone listed in
    // it is by definition a member of the assigned team.
    const request = makeRequest({
      assignedOfficerId: null,
      team: { members: [{ userId: unrelatedOfficer.userId }] },
    });
    expect(canAccessRequest(request, unrelatedOfficer)).toBe(true);
  });

  it('denies an officer who is on no team at all for this request', () => {
    const request = makeRequest({
      assignedOfficerId: null,
      team: { members: [{ userId: 'officer-7' }] },
    });
    expect(canAccessRequest(request, unrelatedOfficer)).toBe(false);
  });

  it('denies everyone when the request has no team and no assignments', () => {
    const request = makeRequest({ assignedOfficerId: null, assignments: [], team: null });
    expect(canAccessRequest(request, unrelatedOfficer)).toBe(false);
    expect(canAccessRequest(request, otherMp)).toBe(false);
    expect(canAccessRequest(request, admin)).toBe(true);
  });

  it('denies an MP even if a team happens to list them', () => {
    // Team membership is an officer-side grant; an MP must never gain access
    // to another MP's request through it.
    const request = makeRequest({
      assignedOfficerId: null,
      team: { members: [{ userId: otherMp.userId }] },
    });
    expect(canAccessRequest(request, otherMp)).toBe(false);
  });
});

describe('authorizeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the request for a permitted actor', async () => {
    const { authorizeRequest } = await import('../../server/lib/authorization');
    const request = makeRequest();
    vi.mocked(prisma.researchRequest.findUnique).mockResolvedValue(request as any);

    await expect(authorizeRequest('req-1', submitter)).resolves.toBe(request);
  });

  it('returns null for an actor with no relationship, without disclosing existence', async () => {
    const { authorizeRequest } = await import('../../server/lib/authorization');
    vi.mocked(prisma.researchRequest.findUnique).mockResolvedValue(makeRequest() as any);

    await expect(authorizeRequest('req-1', unrelatedOfficer)).resolves.toBeNull();
  });

  it('returns null when the request does not exist', async () => {
    const { authorizeRequest } = await import('../../server/lib/authorization');
    vi.mocked(prisma.researchRequest.findUnique).mockResolvedValue(null as any);

    await expect(authorizeRequest('missing', admin)).resolves.toBeNull();
  });
});
