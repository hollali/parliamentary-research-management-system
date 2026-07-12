import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';

interface SettingsViewProps {
  onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSignOut }) => {
  const { currentUser, updateProfile } = useApp();
  const { toast } = useToast();
  const [pName, setPName] = useState(currentUser.name);
  const [pEmail, setPEmail] = useState(currentUser.email);
  const [pConstituency, setPConstituency] = useState((currentUser as any).constituency || '');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const parts = pName.split(' ');
      const firstName = parts[0] || currentUser.name;
      const lastName = parts.slice(1).join(' ') || '';
      await updateProfile({ firstName, lastName, ...(currentUser.role === 'MP' && { constituency: pConstituency }) });
      toast.success('Profile updated successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fadeIn">
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
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none"
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
          {currentUser.role === 'MP' && (
            <div className="space-y-1 max-w-md">
              <label className="text-xs font-bold text-[#434655] uppercase">Constituency</label>
              <input
                type="text"
                value={pConstituency}
                onChange={(e) => setPConstituency(e.target.value)}
                placeholder="e.g. Asawase, Tamale South"
                className="w-full bg-[#f3f4f5] border border-[#c4c5d7] rounded p-2.5 text-xs outline-none"
              />
              <p className="text-[10px] text-gray-400">Your parliamentary constituency</p>
            </div>
          )}
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
              className="border border-[#ba1a1a] text-[#ba1a1a] font-bold text-xs px-4 py-2 rounded hover:bg-red-50 transition-all"
            >
              Sign Out of Secure Portal
            </button>
          </div>
        </div>
      </div>

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
