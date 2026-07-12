import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import { 
  Bell, 
  ShieldAlert, 
  CheckCheck, 
  Trash2, 
  MessageSquare, 
  Clock, 
  Settings, 
  Info,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const { notifications, preferences, markAllNotificationsRead, savePreferences } = useApp();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CRITICAL' | 'RESEARCH' | 'COLLABORATION'>('ALL');
  
  // Local preferences state
  const [pushNotifs, setPushNotifs] = useState(preferences.pushNotifications);
  const [emailDigest, setEmailDigest] = useState(preferences.emailSummaries);
  const [triggers, setTriggers] = useState(preferences.triggers);

  const filteredNotifs = notifications.filter(n => {
    if (activeCategory === 'CRITICAL') return n.type === 'CRITICAL';
    if (activeCategory === 'RESEARCH') return n.type === 'RESEARCH' || n.type === 'WARNING';
    if (activeCategory === 'COLLABORATION') return n.type === 'COLLABORATION';
    return true;
  });

  const handleToggleTrigger = (key: keyof typeof triggers) => {
    setTriggers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveSettings = () => {
    savePreferences(pushNotifs, emailDigest, triggers);
    toast.success('Preferences updated successfully');
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL':
        return <div className="p-2 bg-red-100 text-[#ba1a1a] rounded-full"><ShieldAlert className="w-5 h-5" /></div>;
      case 'RESEARCH':
        return <div className="p-2 bg-blue-100 text-[#0037b0] rounded-full"><Bell className="w-5 h-5" /></div>;
      case 'COLLABORATION':
        return <div className="p-2 bg-[#d5e3fd] text-[#001551] rounded-full"><MessageSquare className="w-5 h-5" /></div>;
      case 'WARNING':
        return <div className="p-2 bg-amber-100 text-amber-800 rounded-full"><Clock className="w-5 h-5" /></div>;
      default:
        return <div className="p-2 bg-gray-100 text-gray-500 rounded-full"><Info className="w-5 h-5" /></div>;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.type === 'CRITICAL').length;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-sans font-bold text-2xl text-[#191c1d]">Notifications & Activity</h2>
          <p className="font-sans text-sm text-[#434655] mt-1">Comprehensive system alerts and activity feed log.</p>
        </div>
        <button 
          onClick={markAllNotificationsRead}
          className="bg-white border border-[#c4c5d7] px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <CheckCheck className="w-4 h-4 text-emerald-800" />
          <span>Mark All Read</span>
        </button>
      </div>

      {/* Notifications Summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm">
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Unread Alerts</p>
          <h3 className="text-2xl font-bold text-[#191c1d] mt-1">{unreadCount < 10 ? `0${unreadCount}` : unreadCount} Alerts</h3>
          <p className="text-[11px] text-gray-500 mt-1">Awaiting review confirmation</p>
        </div>

        <div className="bg-white border border-[#c4c5d7] rounded-lg p-5 shadow-sm">
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">System Events</p>
          <h3 className="text-2xl font-bold text-[#191c1d] mt-1">{notifications.length < 10 ? `0${notifications.length}` : notifications.length} Events</h3>
          <p className="text-[11px] text-gray-500 mt-1">Logged in past 24 hours</p>
        </div>

        <div className="bg-white border border-red-200 bg-red-50/20 rounded-lg p-5 shadow-sm">
          <p className="text-xs font-bold text-[#434655] uppercase tracking-wider">Critical Notices</p>
          <h3 className="text-2xl font-bold text-[#ba1a1a] mt-1">{criticalCount < 10 ? `0${criticalCount}` : criticalCount} Notices</h3>
          <p className="text-[11px] text-red-700 font-semibold mt-1">Requires immediate attention</p>
        </div>
      </div>

      {/* Split Alert inbox and Settings toggles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Alert List Panel */}
        <div className="lg:col-span-2 bg-white border border-[#c4c5d7] rounded-lg shadow-sm overflow-hidden flex flex-col justify-between min-h-[500px]">
          <div>
            {/* Category tabs */}
            <div className="px-6 py-4 bg-[#f3f4f5] border-b border-[#c4c5d7] flex gap-2 flex-wrap">
              <button 
                onClick={() => setActiveCategory('ALL')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCategory === 'ALL' ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-200'
                }`}
              >
                All Alerts
              </button>
              <button 
                onClick={() => setActiveCategory('CRITICAL')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCategory === 'CRITICAL' ? 'bg-[#ba1a1a] text-white' : 'text-[#434655] hover:bg-gray-200'
                }`}
              >
                Critical
              </button>
              <button 
                onClick={() => setActiveCategory('RESEARCH')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCategory === 'RESEARCH' ? 'bg-[#0037b0] text-white' : 'text-[#434655] hover:bg-gray-200'
                }`}
              >
                Inquiries
              </button>
              <button 
                onClick={() => setActiveCategory('COLLABORATION')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeCategory === 'COLLABORATION' ? 'bg-[#001551] text-white' : 'text-[#434655] hover:bg-gray-200'
                }`}
              >
                Collaboration
              </button>
            </div>

            {/* Alert items rows */}
            <div className="divide-y divide-gray-100">
              {filteredNotifs.length > 0 ? (
                filteredNotifs.map((item) => (
                  <div 
                    key={item.id} 
                    className={`p-5 flex gap-4 hover:bg-gray-50/50 transition-colors ${
                      !item.read ? 'bg-blue-50/20 font-medium border-l-4 border-[#0037b0]' : 'border-l-4 border-transparent'
                    }`}
                  >
                    {getNotifIcon(item.type)}
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm text-gray-900 font-bold">{item.title}</h4>
                        <span className="text-[10px] text-gray-400 font-semibold">{item.time}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-normal">{item.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 italic text-sm text-gray-500">
                  No notifications match this category filter.
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-[#f3f4f5]/30 border-t border-[#c4c5d7] text-xs text-gray-500 font-semibold">
            Notifications are cleared automatically after 30 days.
          </div>
        </div>

        {/* Right Panel: Alert Preferences settings */}
        <div className="bg-white border border-[#c4c5d7] rounded-lg p-6 shadow-sm flex flex-col justify-between h-full min-h-[500px]">
          <div className="space-y-6">
            <h4 className="font-sans font-bold text-sm text-[#191c1d] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-3">
              <Settings className="w-4.5 h-4.5 text-[#0037b0]" /> Alert Channels
            </h4>

            {/* Switch 1: Push */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900">In-App Push Banner Alerts</p>
                <p className="text-[10px] text-gray-500">Enable real-time notification popup banners</p>
              </div>
              <button 
                onClick={() => setPushNotifs(!pushNotifs)}
                className={`w-10 h-6 rounded-full p-1 transition-all ${
                  pushNotifs ? 'bg-[#0037b0] flex justify-end' : 'bg-gray-200 flex justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>

            {/* Switch 2: Email */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900">Daily Email Summary</p>
                <p className="text-[10px] text-gray-500">Receive a consolidated morning email brief</p>
              </div>
              <button 
                onClick={() => setEmailDigest(!emailDigest)}
                className={`w-10 h-6 rounded-full p-1 transition-all ${
                  emailDigest ? 'bg-[#0037b0] flex justify-end' : 'bg-gray-200 flex justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>

            {/* Checkboxes Triggers list */}
            <div className="space-y-3.5 border-t border-gray-100 pt-6">
              <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Alert Triggers</h5>
              
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={triggers.newAssignments}
                  onChange={() => handleToggleTrigger('newAssignments')}
                  className="w-4 h-4 rounded border-[#c4c5d7] text-[#0037b0] focus:ring-[#0037b0] mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-gray-700">New assignments appointed</p>
                  <p className="text-[10px] text-gray-500">Notify as soon as brief lead is selected</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={triggers.statusChanges}
                  onChange={() => handleToggleTrigger('statusChanges')}
                  className="w-4 h-4 rounded border-[#c4c5d7] text-[#0037b0] focus:ring-[#0037b0] mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-gray-700">Request status modifications</p>
                  <p className="text-[10px] text-gray-500">Alert on draft submission, reviews, completion</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={triggers.draftMentions}
                  onChange={() => handleToggleTrigger('draftMentions')}
                  className="w-4 h-4 rounded border-[#c4c5d7] text-[#0037b0] focus:ring-[#0037b0] mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-gray-700">Draft mentions & comments</p>
                  <p className="text-[10px] text-gray-500">Alert on direct inline comments on active drafts</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={triggers.deadlineReminders}
                  onChange={() => handleToggleTrigger('deadlineReminders')}
                  className="w-4 h-4 rounded border-[#c4c5d7] text-[#0037b0] focus:ring-[#0037b0] mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold text-gray-700">Deadline proximity alerts</p>
                  <p className="text-[10px] text-gray-500">Trigger warnings at 48 hours and 24 hours remaining</p>
                </div>
              </label>
            </div>
          </div>

          <button 
            onClick={handleSaveSettings}
            className="w-full mt-8 bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>

      </div>
    </div>
  );
};
