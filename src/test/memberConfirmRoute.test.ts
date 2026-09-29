import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';

const { researchRequest, reviewComment, activityLog, user, notification } = vi.hoisted(() => ({
  researchRequest: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  reviewComment: { create: vi.fn() },
  activityLog: { create: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn() },
}));

vi.mock('../../server/lib/prisma.js', () => ({
  default: { researchRequest, reviewComment, activityLog, user, notification },
}));

vi.mock('../../server/lib/notifications.js', () => ({
  shouldNotify: vi.fn().mockResolvedValue(false),
  shouldEmail: vi.fn().mockResolvedValue(false),
  createNotification: vi.fn().mockResolvedValue({ id: 'n1' }),
}));

vi.mock('../../server/lib/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  commentAddedEmail: vi.fn(),
  memberConfirmedEmail: vi.fn().mockReturnValue({ subject: '', html: '', text: '' }),
  draftSubmittedEmail: vi.fn(),
  assignmentEmail: vi.fn(),
  notificationEmail: vi.fn(),
  isSmtpConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { userId: 'mp-1', role: 'MP' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  invalidateActiveUserCache: vi.fn(),
}));

import reviewsRouter from '../../server/routes/reviews';

const MP_ID = 'mp-1';

// Driven over a real HTTP listener rather than by calling the handler
// directly, so the route's own body parsing and status codes are exercised.
let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(reviewsRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function postConfirm(body: unknown) {
  const res = await fetch(`${baseUrl}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('POST /reviews/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user.findMany.mockResolvedValue([]);
    reviewComment.create.mockResolvedValue({ id: 'c1' });
    activityLog.create.mockResolvedValue({ id: 'a1' });
    researchRequest.update.mockResolvedValue({ id: 'req-1', status: 'CLOSED' });
  });

  it('closes the request rather than parking it in a "confirmed" state', async () => {
    researchRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNumber: 'REQ-2026-0001',
      title: 'Cost of school feeding',
      status: 'DELIVERED',
      submitterId: MP_ID,
      memberConfirmedAt: null,
      submitter: { firstName: 'Ama', lastName: 'Mensah' },
    });

    const res = await postConfirm({ requestId: 'req-1', note: 'Thank you' });

    expect(res.status).toBe(200);
    const data = researchRequest.update.mock.calls[0][0].data;
    expect(data.status).toBe('CLOSED');
    expect(data.dateClosed).toBeInstanceOf(Date);
    expect(data.memberConfirmedAt).toBeInstanceOf(Date);
    expect(data.memberConfirmedById).toBe(MP_ID);
    expect(data.memberConfirmationNote).toBe('Thank you');
  });

  it('records the confirmation without leaving a "Confirmed" status behind', async () => {
    researchRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNumber: 'REQ-2026-0001',
      title: 'Cost of school feeding',
      status: 'APPROVED',
      submitterId: MP_ID,
      memberConfirmedAt: null,
      submitter: { firstName: 'Ama', lastName: 'Mensah' },
    });

    await postConfirm({ requestId: 'req-1' });

    const data = researchRequest.update.mock.calls[0][0].data;
    expect(Object.values(data)).not.toContain('MEMBER_CONFIRMED');
    expect(data.memberConfirmationNote).toBeNull();
  });

  it('refuses a second sign-off, since the status can no longer be the guard', async () => {
    researchRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNumber: 'REQ-2026-0001',
      title: 'Cost of school feeding',
      status: 'CLOSED',
      submitterId: MP_ID,
      memberConfirmedAt: new Date('2026-07-01'),
      submitter: { firstName: 'Ama', lastName: 'Mensah' },
    });

    const res = await postConfirm({ requestId: 'req-1' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/already been confirmed/i) });
    expect(researchRequest.update).not.toHaveBeenCalled();
  });

  it('still refuses a legacy row that carries the old status', async () => {
    researchRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNumber: 'REQ-2026-0001',
      title: 'Cost of school feeding',
      status: 'MEMBER_CONFIRMED',
      submitterId: MP_ID,
      memberConfirmedAt: null,
      submitter: { firstName: 'Ama', lastName: 'Mensah' },
    });

    const res = await postConfirm({ requestId: 'req-1' });

    expect(res.status).toBe(409);
    expect(researchRequest.update).not.toHaveBeenCalled();
  });

  it('rejects a brief that was never approved for sign-off', async () => {
    researchRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNumber: 'REQ-2026-0001',
      title: 'Cost of school feeding',
      status: 'DRAFT_SUBMITTED',
      submitterId: MP_ID,
      memberConfirmedAt: null,
      submitter: { firstName: 'Ama', lastName: 'Mensah' },
    });

    const res = await postConfirm({ requestId: 'req-1' });

    expect(res.status).toBe(400);
    expect(researchRequest.update).not.toHaveBeenCalled();
  });
});
