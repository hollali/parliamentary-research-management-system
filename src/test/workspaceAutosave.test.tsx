import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { OfficerRevisionWorkspaceView } from '../components/OfficerRevisionWorkspaceView';
import { useApp } from '../context/AppContext';
import { getRequest, getReviews, getAttachments, createReport, updateReport } from '../lib/api';
import { ToastProvider } from '../lib/toast';


vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/api', () => ({
  getRequest: vi.fn(),
  getReviews: vi.fn(),
  getAttachments: vi.fn(),
  createReport: vi.fn(),
  updateReport: vi.fn(),
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  deleteAttachment: vi.fn(),
}));

vi.mock('../components/editor/RichTextEditor', async () => {
  const actual = await vi.importActual<typeof import('../components/editor/RichTextEditor')>(
    '../components/editor/RichTextEditor',
  );
  return {
    ...actual,
    RichTextEditor: (props: any) =>
      actual.RichTextEditor({
        ...props,
        onReady: (instance: Editor) => {
          (globalThis as any).__editor = instance;
          props.onReady?.(instance);
        },
      }),
  };
});

const mockUseApp = vi.mocked(useApp);
const mockGetRequest = vi.mocked(getRequest);
const mockGetReviews = vi.mocked(getReviews);
const mockGetAttachments = vi.mocked(getAttachments);
const mockCreateReport = vi.mocked(createReport);
const mockUpdateReport = vi.mocked(updateReport);

const REQUEST_ID = 'REQ-200';
const DRAFT_HTML = '<p>The economy is growing steadily this year.</p>';

function currentEditor(): Editor {
  const instance = (globalThis as any).__editor;
  if (!instance) throw new Error('editor not ready');
  return instance;
}

function type(text: string) {
  act(() => {
    currentEditor().commands.insertContent(text);
  });
}

function renderView() {
  return render(
    <ToastProvider>
      <OfficerRevisionWorkspaceView requestId={REQUEST_ID} onBack={vi.fn()} />
    </ToastProvider>,
  );
}

async function mountWithEditor() {
  const utils = renderView();
  await waitFor(() => expect((globalThis as any).__editor).toBeTruthy());
  return utils;
}

describe('OfficerRevisionWorkspaceView autosave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (globalThis as any).__editor = null;

    mockGetReviews.mockResolvedValue([]);
    mockGetAttachments.mockResolvedValue([]);
    mockGetRequest.mockResolvedValue({
      id: REQUEST_ID,
      title: 'Fiscal review',
      reports: [{ id: 'rep-1', content: DRAFT_HTML, version: 3 }],
    } as any);
    mockUpdateReport.mockResolvedValue({ id: 'rep-1' } as any);
    mockCreateReport.mockResolvedValue({ id: 'rep-1', version: 1 } as any);

    mockUseApp.mockReturnValue({
      requests: [],
      updateRequestContent: vi.fn(),
      resolveComment: vi.fn(),
      addComment: vi.fn(),
      updateRequestStatus: vi.fn(),
      templates: [],
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not write to the API when a draft is merely opened', async () => {
    await mountWithEditor();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockUpdateReport).not.toHaveBeenCalled();
    expect(mockCreateReport).not.toHaveBeenCalled();
  });

  it('autosaves after the debounce window once the officer types', async () => {
    await mountWithEditor();
    type(' Additional analysis.');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
    const [reportId, payload] = mockUpdateReport.mock.calls[0];
    expect(reportId).toBe('rep-1');
    expect(payload.content).toContain('Additional analysis.');
  });

  it('persists pending edits when the view unmounts inside the debounce window', async () => {
    const { unmount } = await mountWithEditor();
    type(' Critical late addition.');
    expect(mockUpdateReport).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
    expect(mockUpdateReport.mock.calls[0][1].content).toContain('Critical late addition.');
  });

  it('persists pending edits with keepalive when the page is hidden', async () => {
    await mountWithEditor();
    type(' Closing the tab now.');
    expect(mockUpdateReport).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
    const payload = mockUpdateReport.mock.calls[0][1] as any;
    expect(payload.content).toContain('Closing the tab now.');
  });

  it('saves only once when the page is hidden and then unmounted', async () => {
    const { unmount } = await mountWithEditor();
    type(' Saved exactly once.');

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
  });

  it('does not autosave a document that is still a stub', async () => {
    mockGetRequest.mockResolvedValue({
      id: REQUEST_ID,
      title: 'Fiscal review',
      reports: [{ id: 'rep-1', content: '', version: 1 }],
    } as any);

    await mountWithEditor();
    type('tiny');
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockUpdateReport).not.toHaveBeenCalled();
  });

  it('saves the draft manually without waiting for the debounce', async () => {
    await mountWithEditor();
    type(' Manual save content.');
    await act(async () => {
      screen.getByText('Save Draft').click();
    });

    await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
  });

  it('flushes edits made in the debounce window when Save Draft is pressed', async () => {
    const { unmount } = await mountWithEditor();
    type(' Saved by hand, not by autosave.');

    await act(async () => {
      screen.getByText('Save Draft').click();
    });
    await waitFor(() => expect(mockUpdateReport).toHaveBeenCalledTimes(1));

    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
  });

  it('creates the first report when a draft has never been saved', async () => {
    mockGetRequest.mockResolvedValue({
      id: REQUEST_ID,
      title: 'Fiscal review',
      reports: [],
    } as any);

    const { unmount } = await mountWithEditor();
    type(' First ever content here.');

    await act(async () => {
      unmount();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockCreateReport).toHaveBeenCalledTimes(1);
    expect(mockCreateReport.mock.calls[0][0].content).toContain('First ever content here.');
  });

  it('persists an undone edit so the server does not keep the reverted text', async () => {
    await mountWithEditor();
    type(' temporary');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(mockUpdateReport).toHaveBeenCalledTimes(1);
    expect(mockUpdateReport.mock.calls[0][1].content).toContain('temporary');

    act(() => {
      currentEditor().commands.undo();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(mockUpdateReport).toHaveBeenCalledTimes(2);
    expect(mockUpdateReport.mock.calls[1][1].content).not.toContain('temporary');
  });
});
