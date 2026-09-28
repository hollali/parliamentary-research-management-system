import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsView } from '../components/SettingsView';
import { useApp } from '../context/AppContext';
import { changePassword, getAccountActivity } from '../lib/api';
import { ToastProvider } from '../lib/toast';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../lib/api', () => ({
  changePassword: vi.fn(),
  getAccountActivity: vi.fn(),
  updateUserProfile: vi.fn(),
}));

const mockUseApp = vi.mocked(useApp);
const mockChangePassword = vi.mocked(changePassword);
const mockGetActivity = vi.mocked(getAccountActivity);

const currentUser = {
  id: 'u-1',
  name: 'Jane Doe',
  role: 'MP' as const,
  email: 'jane@parliament.gh',
  initials: 'JD',
  title: '',
  constituency: 'Asawase',
};

const basePrefs = {
  pushNotifications: true,
  emailSummaries: true,
  emailNotifications: true,
  whatsappNotifications: false,
  triggers: {
    newAssignments: true,
    statusChanges: true,
    draftMentions: true,
    deadlineReminders: true,
  },
};

function setup(overrides: Record<string, any> = {}) {
  const savePreferences = vi.fn().mockResolvedValue(undefined);
  const updateProfile = vi.fn().mockResolvedValue(undefined);
  mockUseApp.mockReturnValue({
    currentUser: { ...currentUser, ...(overrides.user || {}) },
    preferences: { ...basePrefs, ...(overrides.preferences || {}) },
    updateProfile,
    savePreferences,
    ...overrides.context,
  } as any);
  return { savePreferences, updateProfile, onSignOut: vi.fn() };
}

function renderSettings(props: { onSignOut: () => void }) {
  return render(
    <ToastProvider>
      <SettingsView {...props} />
    </ToastProvider>,
  );
}

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActivity.mockResolvedValue([]);
  });

  it('renders the three settings sections', async () => {
    renderSettings(setup());
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /security/i })).toBeInTheDocument();
  });

  it('splits the name into editable first and last fields', () => {
    renderSettings(setup());
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Jane');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Doe');
  });

  it('keeps the save button disabled until something changes', async () => {
    const { updateProfile } = setup();
    renderSettings({ onSignOut: vi.fn() });
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Janet' } });
    await waitFor(() => expect(save).toBeEnabled());
  });

  it('rejects a malformed phone number without calling the API', async () => {
    const { updateProfile } = setup();
    renderSettings({ onSignOut: vi.fn() });

    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: 'not-a-number' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/valid phone number/i)).toBeInTheDocument();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('sends a normalised phone number when the profile is saved', async () => {
    const { updateProfile } = setup();
    renderSettings({ onSignOut: vi.fn() });

    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '  +233 20 000 0000  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile.mock.calls[0][0].phone).toBe('+233 20 000 0000');
  });

  it('does not expose a constituency field to non-MP roles', () => {
    renderSettings(setup({ user: { role: 'RESEARCH_OFFICER', constituency: undefined } }));
    expect(screen.queryByLabelText(/constituency/i)).not.toBeInTheDocument();
  });

  it('disables the WhatsApp toggle until a phone number exists', () => {
    renderSettings(setup());
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    const whatsapp = screen.getByRole('switch', { name: /whatsapp alerts/i });
    expect(whatsapp).toBeDisabled();
    expect(screen.getByText(/add a phone number in profile/i)).toBeInTheDocument();
  });

  it('enables the WhatsApp toggle once a phone number is saved', () => {
    renderSettings(setup({ user: { phone: '+233 20 000 0000' } }));
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('switch', { name: /whatsapp alerts/i })).toBeEnabled();
  });

  it('persists a changed notification trigger', async () => {
    const { savePreferences } = setup();
    renderSettings({ onSignOut: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const reminders = screen.getByRole('switch', { name: /deadline reminders/i });
    fireEvent.click(reminders);
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => expect(savePreferences).toHaveBeenCalled());
    expect(savePreferences.mock.calls[0][4].deadlineReminders).toBe(false);
  });

  it('does not offer a save button until preferences change', () => {
    renderSettings(setup());
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('button', { name: /save preferences/i })).toBeDisabled();
  });

  it('rejects a password identical to the current one', async () => {
    setup();
    renderSettings({ onSignOut: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'SamePass1!' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'SamePass1!' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'SamePass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText(/must be different/i)).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('refuses to change the password when the confirmation does not match', async () => {
    setup();
    renderSettings({ onSignOut: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));

    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'OldPass1!' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Different1!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('clears the password fields after a successful change', async () => {
    mockChangePassword.mockResolvedValue({ message: 'ok' } as any);
    setup();
    renderSettings({ onSignOut: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));

    const current = screen.getByLabelText('Current Password');
    fireEvent.change(current, { target: { value: 'OldPass1!' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'NewPass1!' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(current).toHaveValue(''));
    expect(mockChangePassword).toHaveBeenCalledWith('OldPass1!', 'NewPass1!');
  });

  it('lists real account activity instead of security badges', async () => {
    mockGetActivity.mockResolvedValue([
      {
        id: 'a-1',
        action: 'LOGIN',
        entityType: 'User',
        description: 'Jane Doe logged in',
        createdAt: '2026-01-02T10:00:00.000Z',
      },
      {
        id: 'a-2',
        action: 'UPDATED',
        entityType: 'User',
        description: 'Password changed',
        createdAt: '2026-01-01T09:00:00.000Z',
      },
    ] as any);

    setup();
    renderSettings({ onSignOut: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));

    expect(await screen.findByText('Jane Doe logged in')).toBeInTheDocument();
    expect(screen.getByText('Password changed')).toBeInTheDocument();
    // The old page asserted encryption details it never verified.
    expect(screen.queryByText(/RSA-4096/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Two-Factor Authentication/)).not.toBeInTheDocument();
  });

  it('survives an activity endpoint failure', async () => {
    mockGetActivity.mockRejectedValue(new Error('boom'));
    setup();
    renderSettings({ onSignOut: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));

    await waitFor(() => expect(screen.getByText(/no activity recorded yet/i)).toBeInTheDocument());
  });

  it('routes sign out through the handler that clears the session', () => {
    const { onSignOut } = setup();
    renderSettings({ onSignOut });
    fireEvent.click(screen.getByRole('button', { name: /security/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
