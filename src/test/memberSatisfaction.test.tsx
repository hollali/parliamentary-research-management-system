import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemberResearchReviewView } from '../components/MemberResearchReviewView';
import { useApp } from '../context/AppContext';
import { getRequest, getReviews } from '../lib/api';
import { ToastProvider } from '../lib/toast';
import type { ResearchRequest } from '../types';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/api', () => ({
  getRequest: vi.fn(),
  getReviews: vi.fn(),
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
  deleteAttachment: vi.fn(),
  validateUploadFile: vi.fn(),
}));

const mockUseApp = vi.mocked(useApp);

function makeRequest(overrides: Partial<ResearchRequest> = {}): ResearchRequest {
  return {
    id: 'REQ-2026-0001',
    title: 'District health funding review',
    topic: 'Health funding',
    category: 'Health',
    member: 'Hon. Abena Adjei',
    submitterId: 'mp-1',
    assignedOfficerId: null,
    assignedOfficerName: null,
    status: 'DELIVERED',
    priority: 'STANDARD',
    dateSubmitted: '2026-07-01',
    deadline: '2026-07-30',
    description: 'Review district-level allocations',
    language: 'English',
    draftVersion: 2,
    attachments: [],
    comments: [],
    content: '',
    reportId: 'report-1',
    ...overrides,
  } as ResearchRequest;
}

function makeDetail(overrides: Record<string, any> = {}) {
  return {
    id: 'REQ-2026-0001',
    requestNumber: 'REQ-2026-0001',
    title: 'District health funding review',
    status: 'DELIVERED',
    dateCompleted: '2026-07-20T09:00:00.000Z',
    dateSubmitted: '2026-07-01T09:00:00.000Z',
    deadline: '2026-07-30T09:00:00.000Z',
    priority: 'STANDARD',
    memberConfirmedAt: null,
    memberConfirmationNote: null,
    reports: [
      {
        id: 'report-1',
        title: 'District health funding review',
        version: 2,
        isDraft: false,
        isApproved: true,
        approvedAt: '2026-07-20T09:00:00.000Z',
        createdAt: '2026-07-20T09:00:00.000Z',
        content: '<p>Findings</p>',
        author: { id: 'ro-1', firstName: 'Kofi', lastName: 'Mensah', initials: 'KM' },
        versions: [],
      },
    ],
    comments: [],
    attachments: [],
    ...overrides,
  } as any;
}

function setup(request: ResearchRequest, detail: any, handlers: Record<string, any> = {}) {
  mockUseApp.mockReturnValue({
    requests: [request],
    currentUser: { id: 'mp-1', name: 'Hon. Abena Adjei', initials: 'AA', role: 'MP' },
    addComment: vi.fn().mockResolvedValue(true),
    requestRevisionForRequest: vi.fn().mockResolvedValue(undefined),
    approveRequestForReview: vi.fn().mockResolvedValue(undefined),
    confirmMemberSatisfaction: vi.fn().mockResolvedValue(undefined),
    ...handlers,
  } as any);

  render(
    <ToastProvider>
      <MemberResearchReviewView />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReviews).mockResolvedValue([] as any);
});

describe('MP response to a delivered brief', () => {
  it('offers both send-back and satisfaction options once the brief is delivered', async () => {
    vi.mocked(getRequest).mockResolvedValue(makeDetail());
    setup(makeRequest({ status: 'DELIVERED' }), null);

    expect(await screen.findByText(/research brief delivered/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send back with feedback/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i.m satisfied/i })).toBeInTheDocument();
  });

  it('confirms satisfaction and tells the MP the administrators were notified', async () => {
    vi.mocked(getRequest).mockResolvedValue(makeDetail());
    const confirmMemberSatisfaction = vi.fn().mockResolvedValue(undefined);
    setup(makeRequest({ status: 'DELIVERED' }), null, { confirmMemberSatisfaction });

    fireEvent.click(await screen.findByRole('button', { name: /i.m satisfied/i }));
    fireEvent.change(
      await screen.findByLabelText(/remarks/i),
      { target: { value: 'Covers the western region breakdown we needed.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /yes, i'm satisfied/i }));

    await waitFor(() => {
      expect(confirmMemberSatisfaction).toHaveBeenCalledWith(
        'REQ-2026-0001',
        'Covers the western region breakdown we needed.',
      );
    });
    expect(await screen.findByText(/administrators have been notified/i)).toBeInTheDocument();
  });

  it('confirms without a note when the MP leaves the remarks field blank', async () => {
    vi.mocked(getRequest).mockResolvedValue(makeDetail());
    const confirmMemberSatisfaction = vi.fn().mockResolvedValue(undefined);
    setup(makeRequest({ status: 'APPROVED' }), null, { confirmMemberSatisfaction });

    fireEvent.click(await screen.findByRole('button', { name: /i.m satisfied/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, i'm satisfied/i }));

    await waitFor(() => {
      expect(confirmMemberSatisfaction).toHaveBeenCalledWith('REQ-2026-0001', undefined);
    });
  });

  it('sends the brief back with the member feedback when they are not satisfied', async () => {
    vi.mocked(getRequest).mockResolvedValue(makeDetail());
    const requestRevisionForRequest = vi.fn().mockResolvedValue(undefined);
    setup(makeRequest({ status: 'DELIVERED' }), null, { requestRevisionForRequest });

    fireEvent.click(await screen.findByRole('button', { name: /send back with feedback/i }));
    fireEvent.change(
      await screen.findByPlaceholderText(/expand the fiscal impact section/i),
      { target: { value: 'Please add 2025 figures.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^request revision$/i }));

    await waitFor(() => {
      expect(requestRevisionForRequest).toHaveBeenCalledWith(
        'REQ-2026-0001',
        'Please add 2025 figures.',
      );
    });
    expect(await screen.findByText(/research team has been notified/i)).toBeInTheDocument();
  });

  it('hides the response buttons and shows the sign-off once the member confirmed', async () => {
    // Confirming closes the brief, so the status is CLOSED and the sign-off is
    // read from memberConfirmedAt rather than from the status.
    vi.mocked(getRequest).mockResolvedValue(
      makeDetail({
        status: 'CLOSED',
        dateClosed: '2026-07-25T10:30:00.000Z',
        memberConfirmedAt: '2026-07-25T10:30:00.000Z',
        memberConfirmationNote: 'Very useful, thank you.',
      }),
    );
    setup(
      makeRequest({ status: 'CLOSED', dateClosed: '2026-07-25T10:30:00.000Z', memberConfirmedAt: '2026-07-25T10:30:00.000Z' }),
      null,
    );

    expect(await screen.findByText(/you confirmed this brief/i)).toBeInTheDocument();
    expect(screen.getByText(/very useful, thank you\./i)).toBeInTheDocument();
    expect(screen.getByText(/and closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send back with feedback/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /i.m satisfied/i })).toBeNull();
  });

  it('does not re-offer confirmation on a closed brief', async () => {
    vi.mocked(getRequest).mockResolvedValue(
      makeDetail({ status: 'CLOSED', dateClosed: '2026-07-25T10:30:00.000Z' }),
    );
    setup(makeRequest({ status: 'CLOSED', dateClosed: '2026-07-25T10:30:00.000Z' }), null);

    // No sign-off recorded and the brief is closed: read-only, no prompt.
    expect(screen.queryByText(/you confirmed this brief/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /i.m satisfied/i })).toBeNull();
  });
});
