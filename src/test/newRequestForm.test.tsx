import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewRequestFormView } from '../components/NewRequestFormView';
import { useApp } from '../context/AppContext';
import { getUsers } from '../lib/api';
import { ToastProvider } from '../lib/toast';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/api', () => ({ getUsers: vi.fn() }));

const mockUseApp = vi.mocked(useApp);
const mockGetUsers = vi.mocked(getUsers);

function setup(overrides: Record<string, any> = {}) {
  const addRequest = vi.fn().mockResolvedValue(true);
  mockUseApp.mockReturnValue({
    currentUser: {
      id: 'u-1',
      name: 'Jane Doe',
      role: 'MP',
      email: 'jane@parliament.gh',
      initials: 'JD',
      title: '',
    },
    addRequest,
    templates: [],
    ...overrides,
  } as any);
  return { addRequest };
}

function renderForm() {
  return render(
    <ToastProvider>
      <NewRequestFormView onSuccess={vi.fn()} />
    </ToastProvider>,
  );
}

/** Fill step 1 and advance so the request can be submitted. */
function completeStep1() {
  fireEvent.change(screen.getByLabelText(/research topic/i), {
    target: { value: 'Carbon taxation policy' },
  });
  fireEvent.change(screen.getByLabelText(/requesting office/i), {
    target: { value: 'Office of the Minority Leader' },
  });
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

describe('NewRequestFormView request source fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue([]);
  });

  it('offers one topic field, not two', () => {
    setup();
    renderForm();
    expect(screen.getAllByLabelText(/research topic/i)).toHaveLength(1);
    expect(screen.queryByLabelText(/specific request topic/i)).not.toBeInTheDocument();
  });

  it('asks which office or ministry the request comes from', () => {
    setup();
    renderForm();
    expect(screen.getByLabelText(/requesting office/i)).toBeInTheDocument();
  });

  it('does not ask for a committee', () => {
    setup();
    renderForm();
    expect(screen.queryByLabelText(/^committee$/i)).not.toBeInTheDocument();
  });

  it('blocks step 1 until both topic and office are provided', () => {
    setup();
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/research topic is required/i)).toBeInTheDocument();
    expect(screen.getByText(/requesting office or ministry is required/i)).toBeInTheDocument();

    // Filling only the topic must still be blocked, and no committee error appears.
    fireEvent.change(screen.getByLabelText(/research topic/i), {
      target: { value: 'Carbon taxation policy' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/requesting office or ministry is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/committee is required/i)).not.toBeInTheDocument();
  });

  it('sends the topic once as the title, with the office, and no dead fields', async () => {
    const { addRequest } = setup();
    renderForm();
    completeStep1();

    fireEvent.change(screen.getByLabelText(/request scope/i), {
      target: { value: 'Assess the legal framework for carbon taxation.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByRole('button', { name: /submit/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(addRequest).toHaveBeenCalled());
    const payload = addRequest.mock.calls[0][0];

    expect(payload.title).toBe('Carbon taxation policy');
    expect(payload.requestingOffice).toBe('Office of the Minority Leader');
    // These used to carry a duplicate of the topic; the server either ignored
    // them or stored a byte-for-byte copy of the title.
    expect(payload.scope).toBeUndefined();
    expect(payload.category).toBeUndefined();
    expect(payload.committeeId).toBeUndefined();
  });
});
