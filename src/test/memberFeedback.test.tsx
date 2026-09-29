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
    status: 'DRAFT_SUBMITTED',
    priority: 'STANDARD',
    dateSubmitted: '2026-07-01',
    deadline: '2026-07-30',
    description: 'Review district-level allocations',
    language: 'English',
    draftVersion: 1,
    attachments: [],
    comments: [],
    content: '',
    ...overrides,
  } as ResearchRequest;
}

function setup(addComment: ReturnType<typeof vi.fn>) {
  const request = makeRequest();
  mockUseApp.mockReturnValue({
    requests: [request],
    currentUser: { id: 'mp-1', name: 'Hon. Abena Adjei', initials: 'AA', role: 'MP' },
    addComment,
    requestRevisionForRequest: vi.fn(),
    approveRequestForReview: vi.fn(),
  } as any);

  render(
    <ToastProvider>
      <MemberResearchReviewView />
    </ToastProvider>,
  );
  return request;
}

async function submitFeedback(text: string) {
  const textarea = await screen.findByPlaceholderText(/ask for focus updates/i);
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /send memo/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRequest).mockResolvedValue({
    attachments: [],
    comments: [],
    content: '<p>Draft content</p>',
  } as any);
  vi.mocked(getReviews).mockResolvedValue([] as any);
});

describe('MP feedback on the review center', () => {
  it('waits for persistence and confirms success only when the comment is saved', async () => {
    const addComment = vi.fn().mockResolvedValue(true);
    setup(addComment);

    await submitFeedback('Please prioritise district-level figures.');

    await waitFor(() => {
      expect(addComment).toHaveBeenCalledWith('REQ-2026-0001', 'Please prioritise district-level figures.');
    });
    expect(await screen.findByText(/appended to the request timeline/i)).toBeInTheDocument();
  });

  it('surfaces a failure and keeps the text instead of reporting a false success', async () => {
    const addComment = vi.fn().mockResolvedValue(false);
    setup(addComment);

    await submitFeedback('Please prioritise district-level figures.');

    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/appended to the request timeline/i)).not.toBeInTheDocument();
    // Draft text is retained so the MP does not lose their feedback.
    expect(screen.getByPlaceholderText(/ask for focus updates/i)).toHaveValue(
      'Please prioritise district-level figures.',
    );
  });

  it('still records feedback for a request that has no report yet', async () => {
    const addComment = vi.fn().mockResolvedValue(true);
    const request = makeRequest({ status: 'REVISION_REQUESTED' });
    expect(request.reportId ?? null).toBeNull();

    mockUseApp.mockReturnValue({
      requests: [request],
      currentUser: { id: 'mp-1', name: 'Hon. Abena Adjei', initials: 'AA', role: 'MP' },
      addComment,
      requestRevisionForRequest: vi.fn(),
      approveRequestForReview: vi.fn(),
    } as any);

    render(
      <ToastProvider>
        <MemberResearchReviewView />
      </ToastProvider>,
    );

    await submitFeedback('No draft yet, but please start with the western region.');

    await waitFor(() => {
      expect(addComment).toHaveBeenCalledWith(
        'REQ-2026-0001',
        'No draft yet, but please start with the western region.',
      );
    });
  });
});
