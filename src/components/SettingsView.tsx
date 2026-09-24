import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { changePassword } from '../lib/api';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Briefcase,
  CheckCircle2,
  LogOut,
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

export const SettingsView: React.FC<SettingsViewProps> = ({ onSignOut }) => {
  const { currentUser, updateProfile } = useApp();
  const { toast } = useToast();
  const [pName, setPName] = useState(currentUser.name);
  const [pEmail, setPEmail] = useState(currentUser.email);
  const [pTitle, setPTitle] = useState(currentUser.title && currentUser.title !== currentUser.role ? currentUser.title : '');
  const [pConstituency, setPConstituency] = useState(currentUser.constituency || '');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const parts = pName.split(' ');
      const firstName = parts[0] || currentUser.name;
      const lastName = parts.slice(1).join(' ') || '';
      await updateProfile({
        firstName,
        lastName,
        ...(pTitle.trim() && { title: pTitle.trim() }),
        ...(currentUser.role === 'MP' && { constituency: pConstituency }),
      });
      toast.success('Profile updated successfully');
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

  const pwStrength = useMemo(() => {
    if (!newPassword) return null;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[a-zA-Z]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  }, [newPassword]);

  const pwChecks = [
    { label: 'At least 8 characters', ok: (newPassword.length >= 8) },
    { label: 'Contains a letter', ok: /[a-zA-Z]/.test(newPassword) },
    { label: 'Contains a number', ok: /[0-9]/.test(newPassword) },
    { label: 'Contains a symbol', ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const strengthLabel = pwStrength == null ? null : pwStrength <= 2 ? 'Weak' : pwStrength === 3 ? 'Fair' : 'Strong';
  const strengthColors = ['bg-[#ba1a1a]', 'bg-[#ba1a1a]', 'bg-amber-500', 'bg-amber-500', 'bg-[#006b2c]'];

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
      {/* Page header */}
      <div>
        <h2 className="font-sans font-bold text-3xl text-[#191c1d]">Settings</h2>
        <p className="font-sans text-sm text-[#434655] mt-1.5">Manage your profile, credentials, and portal security.</p>
      </div>

      {/* Identity banner */}
      <div className="bg-white border border-[#c4c5d7] rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-[#0037b0] to-[#1d4ed8] px-6 py-1" />
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#dce1ff] text-[#0039b5] flex items-center justify-center font-bold text-lg shrink-0">
            {currentUser.initials || currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lg text-[#191c1d] leading-tight">{currentUser.name}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGES[currentUser.role] || 'bg-gray-100 text-gray-600'}`}>
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
            </div>
          </div>
        </div>
      </div>

      {/* Profile Settings */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[#0037b0]" />
          <h3 className="font-sans font-bold text-[#191c1d]">Profile Settings</h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">Account Name</label>
              <input
                type="text"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">Official Email Address</label>
              <input
                type="email"
                value={pEmail}
                disabled
                className="w-full bg-gray-100 border border-[#c4c5d7] rounded p-2.5 text-xs outline-none text-gray-500"
              />
              <p className="text-[10px] text-gray-400">Email cannot be changed here</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">Title / Position</label>
              <input
                type="text"
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder={currentUser.role === 'MP' ? 'e.g. Member of Parliament' : 'e.g. Senior Research Officer'}
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
              />
              <p className="text-[10px] text-gray-400">Shown alongside your name across the portal</p>
            </div>
            {currentUser.role === 'MP' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#434655] uppercase">Constituency</label>
                <input
                  type="text"
                  value={pConstituency}
                  onChange={(e) => setPConstituency(e.target.value)}
                  placeholder="e.g. Asawase, Tamale South"
                  className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-[#0037b0]"
                />
                <p className="text-[10px] text-gray-400">Your parliamentary constituency</p>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="bg-[#0037b0] text-white font-bold text-xs px-4 py-2 rounded shadow hover:bg-[#1d4ed8] transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update Profile Details'}
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 border border-[#ba1a1a] text-[#ba1a1a] font-bold text-xs px-4 py-2 rounded hover:bg-red-50 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex items-center gap-2">
          <Lock className="w-5 h-5 text-[#0037b0]" />
          <h3 className="font-sans font-bold text-[#191c1d]">Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          <div className="space-y-1 max-w-md">
            <label className="text-xs font-bold text-[#434655] uppercase">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none pr-10 focus:ring-1 focus:ring-[#0037b0]"
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d]">
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none pr-10 focus:ring-1 focus:ring-[#0037b0]"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d]">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwStrength != null && (
                <div className="pt-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1 flex-1 rounded-full ${i <= pwStrength ? strengthColors[pwStrength] : 'bg-[#e0e1e6]'} transition-colors`} />
                    ))}
                  </div>
                  <p className={`text-[10px] font-bold mt-1 ${pwStrength <= 2 ? 'text-[#ba1a1a]' : pwStrength === 3 ? 'text-amber-600' : 'text-[#006b2c]'}`}>
                    {strengthLabel} strength
                  </p>
                </div>
              )}
              {newPassword.length > 0 && (
                <ul className="pt-1.5 space-y-0.5">
                  {pwChecks.map((c) => (
                    <li key={c.label} className={`text-[10px] flex items-center gap-1.5 ${c.ok ? 'text-[#006b2c]' : 'text-gray-400'}`}>
                      <CheckCircle2 className={`w-3 h-3 ${c.ok ? 'text-[#006b2c]' : 'text-gray-300'}`} /> {c.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#434655] uppercase">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none pr-10 focus:ring-1 focus:ring-[#0037b0]"
                />
                <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747686] hover:text-[#191c1d]">
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="text-[10px] font-semibold text-[#ba1a1a]">Passwords do not match</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={changingPw}
              className="bg-[#0037b0] text-white font-bold text-xs px-4 py-2 rounded shadow hover:bg-[#1d4ed8] transition-all disabled:opacity-50"
            >
              {changingPw ? 'Changing...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Security Credentials */}
      <div className="bg-white border border-[#c4c5d7] rounded-lg shadow-sm p-6 space-y-4">
        <h4 className="font-bold text-sm text-[#191c1d] flex items-center gap-1.5 border-b border-gray-100 pb-2">
          <ShieldCheck className="w-4.5 h-4.5 text-emerald-800" /> Security Credentials
        </h4>
        <p className="text-xs text-gray-500">Your session is bound to standard credentials. Two-Factor Authentication (MFA) is actively managed by your legislative IT center.</p>
        <div className="flex gap-2">
          <span className="text-[10px] bg-emerald-100 text-[#00501f] font-bold px-2 py-0.5 rounded-full">Secure SSL</span>
          <span className="text-[10px] bg-blue-100 text-[#0039b5] font-bold px-2 py-0.5 rounded-full">RSA-4096</span>
        </div>
      </div>
    </div>
  );
};