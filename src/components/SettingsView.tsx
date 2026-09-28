import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { changePassword, getAccountActivity, type AccountActivity } from '../lib/api';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
  LogOut,
  Bell,
  History,
  User as UserIcon,
  Info,
} from 'lucide-react';

interface SettingsViewProps {
  onSignOut: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  RESEARCH_OFFICER: 'Research Officer',
  MP: 'Member of Parliament',
};

const ROLE_BADGES: Record<string, string> = {
  ADMIN: 'bg-[#dce1ff] text-[#0039b5]',
  RESEARCH_OFFICER: 'bg-indigo-50 text-indigo-700',
  MP: 'bg-emerald-50 text-[#00501f]',
};

type Tab = 'profile' | 'notifications' | 'security';

const PREF_TRIGGER_KEYS = [
  'newAssignments',
  'statusChanges',
  'draftMentions',
  'deadlineReminders',
] as const;

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

const inputClass =
  'w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-[#0039b0] disabled:bg-gray-100 disabled:text-gray-500';
const labelClass = 'text-xs font-bold text-[#434655] uppercase';
const hintClass = 'text-[10px] text-gray-400';
const primaryButton =
  'bg-[#0037b0] text-white font-bold text-xs px-4 py-2 rounded shadow hover:bg-[#1d4ed8] transition-all disabled:opacity-50 disabled:cursor-not-allowed';

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0039b0] focus-visible:ring-offset-2 shrink-0 ${
        checked ? 'bg-[#0037b0]' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  children,
  disabled,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-start gap-2.5">
        <Icon className="w-5 h-5 text-[#0039b0] shrink-0 mt-0.5" />
        <div>
          <h3 className="font-sans font-bold text-[#191c1d]">{title}</h3>
          <p className="text-[11px] text-[#747686] mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSignOut }) => {
  const { currentUser, updateProfile, preferences, savePreferences } = useApp();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // ── Profile state ──
  const [pFirstName, setPFirstName] = useState(currentUser.name.split(' ')[0] || '');
  const [pLastName, setPLastName] = useState(
    currentUser.name.split(' ').slice(1).join(' '),
  );
  const [pTitle, setPTitle] = useState(
    currentUser.title && currentUser.title !== currentUser.role ? currentUser.title : '',
  );
  const [pConstituency, setPConstituency] = useState(currentUser.constituency || '');
  const [pPhone, setPPhone] = useState(currentUser.phone || '');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Password state ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // ── Notification state ──
  const [pushNotifs, setPushNotifs] = useState(preferences.pushNotifications);
  const [emailSummaries, setEmailSummaries] = useState(preferences.emailSummaries);
  const [emailRealTime, setEmailRealTime] = useState(preferences.emailNotifications);
  const [whatsapp, setWhatsapp] = useState(preferences.whatsappNotifications);
  const [triggers, setTriggers] = useState(preferences.triggers);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ── Activity state ──
  const [activity, setActivity] = useState<AccountActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Keep local form state in step with preferences loaded asynchronously after mount.
  useEffect(() => {
    setPushNotifs(preferences.pushNotifications);
    setEmailSummaries(preferences.emailSummaries);
    setEmailRealTime(preferences.emailNotifications);
    setWhatsapp(preferences.whatsappNotifications);
    setTriggers(preferences.triggers);
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    getAccountActivity()
      .then((logs) => {
        if (!cancelled) setActivity(logs || []);
      })
      .catch(() => {
        /* activity is supplementary; the settings form stays usable without it */
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const validatePhone = useCallback((value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^\+?[0-9][0-9\s()-]{6,19}$/.test(trimmed)) {
      return 'Enter a valid phone number, ideally with country code';
    }
    return '';
  }, []);

  const profileDirty = useMemo(() => {
    const [first, ...rest] = currentUser.name.split(' ');
    return (
      pFirstName.trim() !== (first || '') ||
      pLastName.trim() !== rest.join(' ') ||
      pTitle.trim() !== (currentUser.title && currentUser.title !== currentUser.role ? currentUser.title : '') ||
      (currentUser.role === 'MP' && pConstituency.trim() !== (currentUser.constituency || '')) ||
      pPhone.trim() !== (currentUser.phone || '')
    );
  }, [pFirstName, pLastName, pTitle, pConstituency, pPhone, currentUser]);

  const handleUpdate = async () => {
    const errors: Record<string, string> = {};
    if (!pFirstName.trim()) errors.firstName = 'First name is required';
    const phoneError = validatePhone(pPhone);
    if (phoneError) errors.phone = phoneError;
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error('Please correct the highlighted fields');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        firstName: pFirstName.trim(),
        lastName: pLastName.trim(),
        title: pTitle.trim(),
        ...(currentUser.role === 'MP' && { constituency: pConstituency.trim() }),
        phone: pPhone.trim(),
      });
      toast.success('Profile updated successfully');
      setFieldErrors({});
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from the current one');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await savePreferences(pushNotifs, emailSummaries, emailRealTime, whatsapp, triggers);
      toast.success('Notification preferences saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notification preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const prefsDirty = useMemo(
    () =>
      pushNotifs !== preferences.pushNotifications ||
      emailSummaries !== preferences.emailSummaries ||
      emailRealTime !== preferences.emailNotifications ||
      whatsapp !== preferences.whatsappNotifications ||
      PREF_TRIGGER_KEYS.some((key) => triggers[key] !== preferences.triggers[key]),
    [pushNotifs, emailSummaries, emailRealTime, whatsapp, triggers, preferences],
  );

  const pwChecks = [
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'Contains a letter', ok: /[a-zA-Z]/.test(newPassword) },
    { label: 'Contains a number', ok: /[0-9]/.test(newPassword) },
    { label: 'Contains a symbol', ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const metCount = pwChecks.filter((c) => c.ok).length;
  const pwStrength = newPassword ? metCount : null;
  const strengthLabel = pwStrength == null ? null : pwStrength <= 2 ? 'Weak' : pwStrength === 3 ? 'Fair' : 'Strong';
  const strengthColors = ['bg-[#ba1a1a]', 'bg-[#ba1a1a]', 'bg-amber-500', 'bg-amber-500', 'bg-[#006b2c]'];

  const displayName = currentUser.name || `${pFirstName} ${pLastName}`.trim();
  const initials =
    currentUser.initials ||
    displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  const whatsappBlocked = !pPhone.trim() && !currentUser.phone;

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Page header */}
      <div>
        <h2 className="font-sans font-bold text-3xl text-[#191c1d]">Settings</h2>
        <p className="font-sans text-sm text-[#434655] mt-1.5">
          Manage your profile, notification channels, and account security.
        </p>
      </div>

      {/* Identity banner */}
      <div className="bg-white border border-[#c4c5d7] rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0037b0] to-[#1d4ed8] px-6 py-1" />
        <div className="px-6 py-5 flex items-center gap-4">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt=""
              className="w-14 h-14 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#dce1ff] text-[#0039b5] flex items-center justify-center font-bold text-lg shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg text-[#191c1d] leading-tight">{displayName}</p>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  ROLE_BADGES[currentUser.role] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {ROLE_LABELS[currentUser.role] || currentUser.role}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-[#747686] flex-wrap">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {currentUser.email}
              </span>
              {currentUser.title && currentUser.title !== currentUser.role && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> {currentUser.title}
                </span>
              )}
              {currentUser.role === 'MP' && currentUser.constituency && (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {currentUser.constituency}
                </span>
              )}
              {(currentUser.phone || pPhone) && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {currentUser.phone || pPhone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === id
                ? 'bg-white text-[#191c1d] shadow-sm'
                : 'text-[#434655] hover:text-[#191c1d]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Profile ── */}
      {activeTab === 'profile' && (
        <div className="space-y-6 animate-fadeIn">
          <SectionCard
            title="Profile Details"
            description="Your name and role across the portal. Changes are recorded in your account activity."
            icon={UserIcon}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass} htmlFor="firstName">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={pFirstName}
                  onChange={(e) => setPFirstName(e.target.value)}
                  aria-invalid={!!fieldErrors.firstName}
                  className={`${inputClass} ${fieldErrors.firstName ? 'border-[#ba1a1a]' : ''}`}
                />
                {fieldErrors.firstName && (
                  <p className="text-[10px] font-semibold text-[#ba1a1a]">{fieldErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor="lastName">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={pLastName}
                  onChange={(e) => setPLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className={labelClass} htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  placeholder="+233 20 000 0000"
                  aria-invalid={!!fieldErrors.phone}
                  className={`${inputClass} ${fieldErrors.phone ? 'border-[#ba1a1a]' : ''}`}
                />
                {fieldErrors.phone ? (
                  <p className="text-[10px] font-semibold text-[#ba1a1a]">{fieldErrors.phone}</p>
                ) : (
                  <p className={hintClass}>Required for WhatsApp alerts. Include your country code.</p>
                )}
              </div>
              <div className="space-y-1">
                <label className={labelClass} htmlFor="title">
                  Title / Position
                </label>
                <input
                  id="title"
                  type="text"
                  value={pTitle}
                  onChange={(e) => setPTitle(e.target.value)}
                  placeholder={
                    currentUser.role === 'MP'
                      ? 'e.g. Member of Parliament'
                      : 'e.g. Senior Research Officer'
                  }
                  className={inputClass}
                />
                <p className={hintClass}>Shown alongside your name across the portal</p>
              </div>
            </div>

            {currentUser.role === 'MP' && (
              <div className="space-y-1 max-w-md">
                <label className={labelClass} htmlFor="constituency">
                  Constituency
                </label>
                <input
                  id="constituency"
                  type="text"
                  value={pConstituency}
                  onChange={(e) => setPConstituency(e.target.value)}
                  placeholder="e.g. Asawase, Tamale South"
                  className={inputClass}
                />
                <p className={hintClass}>Your parliamentary constituency</p>
              </div>
            )}

            <div className="space-y-1 max-w-md">
              <label className={labelClass} htmlFor="email">
                Official Email Address
              </label>
              <input id="email" type="email" value={currentUser.email} readOnly disabled className={inputClass} />
              <p className={hintClass}>
                Your email identifies your account and is used for sign-in. Contact an
                administrator to change it.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={handleUpdate} disabled={saving || !profileDirty} className={primaryButton}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {profileDirty && !saving && (
                <span className="self-center text-[10px] text-gray-400">Unsaved changes</span>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Notifications ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-6 animate-fadeIn">
          <SectionCard
            title="Delivery Channels"
            description="Choose how the portal reaches you. Changes apply immediately."
            icon={Bell}
          >
            <SettingRow
              title="In-app notifications"
              description="Show alerts in the browser notification centre"
            >
              <Toggle
                checked={pushNotifs}
                onChange={setPushNotifs}
                label="In-app notifications"
              />
            </SettingRow>

            <SettingRow
              title="Email summaries"
              description="Receive a daily digest of activity on your account"
            >
              <Toggle
                checked={emailSummaries}
                onChange={setEmailSummaries}
                label="Email summaries"
              />
            </SettingRow>

            <SettingRow
              title="Real-time email"
              description="Send an email immediately for each assignment, status change, and mention"
            >
              <Toggle
                checked={emailRealTime}
                onChange={setEmailRealTime}
                label="Real-time email"
              />
            </SettingRow>

            <SettingRow
              title="WhatsApp alerts"
              description={
                whatsappBlocked
                  ? 'Add a phone number in Profile to enable WhatsApp alerts'
                  : 'Send urgent deadline alerts to your phone'
              }
              disabled={whatsappBlocked}
            >
              <Toggle
                checked={whatsapp && !whatsappBlocked}
                onChange={setWhatsapp}
                label="WhatsApp alerts"
                disabled={whatsappBlocked}
              />
            </SettingRow>
          </SectionCard>

          <SectionCard
            title="What Triggers Alerts"
            description="Pick the events worth interrupting you for."
            icon={Bell}
          >
            <SettingRow
              title="New assignments"
              description="A research request is assigned to you"
            >
              <Toggle
                checked={triggers.newAssignments}
                onChange={(v) => setTriggers((p) => ({ ...p, newAssignments: v }))}
                label="New assignments"
              />
            </SettingRow>
            <SettingRow
              title="Status changes"
              description="A request you are involved in moves to a new stage"
            >
              <Toggle
                checked={triggers.statusChanges}
                onChange={(v) => setTriggers((p) => ({ ...p, statusChanges: v }))}
                label="Status changes"
              />
            </SettingRow>
            <SettingRow
              title="Draft mentions"
              description="You are mentioned in a report or review comment"
            >
              <Toggle
                checked={triggers.draftMentions}
                onChange={(v) => setTriggers((p) => ({ ...p, draftMentions: v }))}
                label="Draft mentions"
              />
            </SettingRow>
            <SettingRow
              title="Deadline reminders"
              description="A request passes its deadline while still open"
            >
              <Toggle
                checked={triggers.deadlineReminders}
                onChange={(v) => setTriggers((p) => ({ ...p, deadlineReminders: v }))}
                label="Deadline reminders"
              />
            </SettingRow>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSavePreferences}
                disabled={savingPrefs || !prefsDirty}
                className={primaryButton}
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
              {prefsDirty && !savingPrefs && (
                <span className="self-center text-[10px] text-gray-400">Unsaved changes</span>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Security ── */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-fadeIn">
          <SectionCard
            title="Change Password"
            description="Use at least 8 characters with a mix of letters, numbers, and symbols."
            icon={Lock}
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1 max-w-md">
                <label className={labelClass} htmlFor="currentPassword">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    aria-label={showCurrentPw ? 'Hide current password' : 'Show current password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d]"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                <div className="space-y-1">
                  <label className={labelClass} htmlFor="newPassword">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      aria-label={showNewPw ? 'Hide new password' : 'Show new password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d]"
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pwStrength != null && (
                    <div className="pt-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full ${
                              i <= pwStrength ? strengthColors[pwStrength] : 'bg-[#e0e1e6]'
                            } transition-colors`}
                          />
                        ))}
                      </div>
                      <p
                        className={`text-[10px] font-bold mt-1 ${
                          pwStrength <= 2
                            ? 'text-[#ba1a1a]'
                            : pwStrength === 3
                              ? 'text-amber-600'
                              : 'text-[#006b2c]'
                        }`}
                      >
                        {strengthLabel} strength
                      </p>
                    </div>
                  )}
                  {newPassword.length > 0 && (
                    <ul className="pt-1.5 space-y-0.5">
                      {pwChecks.map((c) => (
                        <li
                          key={c.label}
                          className={`text-[10px] flex items-center gap-1.5 ${
                            c.ok ? 'text-[#006b2c]' : 'text-gray-400'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-3 h-3 ${c.ok ? 'text-[#006b2c]' : 'text-gray-300'}`}
                          />{' '}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1">
                  <label className={labelClass} htmlFor="confirmPassword">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className={`${inputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d]"
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                    <p className="text-[10px] font-semibold text-[#ba1a1a]">Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <button type="submit" disabled={changingPw} className={primaryButton}>
                  {changingPw ? 'Changing...' : 'Update Password'}
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Recent Account Activity"
            description="Sign-ins and account changes recorded for your user."
            icon={History}
          >
            {activityLoading ? (
              <p className="text-xs text-gray-400">Loading activity...</p>
            ) : activity.length === 0 ? (
              <p className="text-xs text-gray-400">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {activity.map((entry) => (
                  <li key={entry.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          entry.action === 'LOGIN'
                            ? 'bg-emerald-50 text-emerald-700'
                            : entry.action === 'LOGOUT'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-[#dce1ff] text-[#0039b5]'
                        }`}
                      >
                        {entry.action === 'LOGIN' ? (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        ) : entry.action === 'LOGOUT' ? (
                          <LogOut className="w-3.5 h-3.5" />
                        ) : (
                          <SettingsIcon className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{entry.description}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(entry.createdAt).toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Session"
            description="Sign out of this browser."
            icon={Info}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-500">
                You are signed in as <span className="font-semibold text-gray-700">{currentUser.email}</span>.
                Signing out clears your session token from this browser.
              </p>
              <button
                onClick={onSignOut}
                className="flex items-center justify-center gap-1.5 border border-[#ba1a1a] text-[#ba1a1a] font-bold text-xs px-4 py-2 rounded hover:bg-red-50 transition-all shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
};
