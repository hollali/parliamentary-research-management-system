import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../lib/toast';
import {
  Bell,
  ShieldAlert,
  CheckCheck,
  MessageSquare,
  Clock,
  Settings,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Inbox,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { NotificationItem } from '../types';

interface NotificationsViewProps {
  onNavigate: (view: string, targetId?: string) => void;
}

type FilterTab = 'ALL' | 'UNREAD' | 'CRITICAL' | 'RESEARCH' | 'WARNING' | 'COLLABORATION';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: diffDay > 365 ? 'numeric' : undefined,
  });
}

function dateGroup(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - itemDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Earlier this week';
  if (diffDays < 30) return 'Earlier this month';
  return 'Older';
}

const TYPE_CONFIG: Record<
  NotificationItem['type'],
  { icon: React.ReactNode; bg: string; text: string; label: string }
> = {
  CRITICAL: {
    icon: <ShieldAlert className="w-4 h-4" />,
    bg: 'bg-red-50',
    text: 'text-[#ba1a1a]',
    label: 'Critical',
  },
  RESEARCH: {
    icon: <FileText className="w-4 h-4" />,
    bg: 'bg-blue-50',
    text: 'text-[#0037b0]',
    label: 'Research',
  },
  COLLABORATION: {
    icon: <MessageSquare className="w-4 h-4" />,
    bg: 'bg-indigo-50',
    text: 'text-[#001551]',
    label: 'Collaboration',
  },
  WARNING: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    label: 'Warning',
  },
};

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'RESEARCH', label: 'Research' },
  { key: 'WARNING', label: 'Warnings' },
  { key: 'COLLABORATION', label: 'Collaboration' },
];

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const {
    notifications,
    preferences,
    markAllNotificationsRead,
    markNotificationRead,
    savePreferences,
  } = useApp();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [activeSection, setActiveSection] = useState<'notifications' | 'settings'>('notifications');

  // Preferences local state
  const [pushNotifs, setPushNotifs] = useState(preferences.pushNotifications);
  const [emailDigest, setEmailDigest] = useState(preferences.emailSummaries);
  const [emailNotifs, setEmailNotifs] = useState(preferences.emailNotifications);
  const [whatsappNotifs, setWhatsappNotifs] = useState(preferences.whatsappNotifications);
  const [triggers, setTriggers] = useState(preferences.triggers);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    switch (activeTab) {
      case 'UNREAD':
        return notifications.filter((n) => !n.read);
      case 'CRITICAL':
        return notifications.filter((n) => n.type === 'CRITICAL');
      case 'RESEARCH':
        return notifications.filter((n) => n.type === 'RESEARCH');
      case 'WARNING':
        return notifications.filter((n) => n.type === 'WARNING');
      case 'COLLABORATION':
        return notifications.filter((n) => n.type === 'COLLABORATION');
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {};
    for (const n of filtered) {
      const g = dateGroup(n.createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    }
    return Object.entries(groups);
  }, [filtered]);

  const handleNotifClick = (notif: NotificationItem) => {
    if (!notif.read) {
      markNotificationRead(notif.id);
    }
    if (notif.link) {
      // link is like /briefs/<requestNumber> — extract the view and id
      const parts = notif.link.replace(/^\//, '').split('/');
      if (parts.length >= 2) {
        onNavigate(parts[0], parts[1]);
      } else if (parts.length === 1) {
        onNavigate(parts[0]);
      }
    }
  };

  const handleToggleTrigger = (key: keyof typeof triggers) => {
    setTriggers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveSettings = async () => {
    try {
      await savePreferences(pushNotifs, emailDigest, emailNotifs, whatsappNotifs, triggers);
      toast.success('Notification preferences saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save notification preferences');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0037b0] text-white flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-xl text-[#191c1d]">Notifications</h2>
            <p className="text-xs text-[#434655]">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="bg-white border border-[#c4c5d7] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-gray-50 transition-colors shadow-sm self-start"
          >
            <CheckCheck className="w-4 h-4 text-emerald-700" />
            Mark all read
          </button>
        )}
      </div>

      {/* Section tabs: Notifications / Settings */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveSection('notifications')}
          className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'notifications'
              ? 'bg-white text-[#191c1d] shadow-sm'
              : 'text-[#434655] hover:text-[#191c1d]'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1 bg-[#ba1a1a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSection('settings')}
          className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeSection === 'settings'
              ? 'bg-white text-[#191c1d] shadow-sm'
              : 'text-[#434655] hover:text-[#191c1d]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Preferences
        </button>
      </div>

      {/* ── Notifications Section ── */}
      {activeSection === 'notifications' && (
        <div className="bg-white border border-[#c4c5d7] rounded-xl shadow-sm overflow-hidden">
          {/* Filter pills */}
          <div className="px-5 py-3 border-b border-gray-100 flex gap-2 overflow-x-auto">
            {TABS.map((tab) => {
              const count =
                tab.key === 'ALL'
                  ? notifications.length
                  : tab.key === 'UNREAD'
                    ? unreadCount
                    : tab.key === 'CRITICAL'
                      ? notifications.filter((n) => n.type === 'CRITICAL').length
                      : tab.key === 'RESEARCH'
                        ? notifications.filter((n) => n.type === 'RESEARCH').length
                        : tab.key === 'WARNING'
                          ? notifications.filter((n) => n.type === 'WARNING').length
                          : notifications.filter((n) => n.type === 'COLLABORATION').length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? tab.key === 'CRITICAL'
                        ? 'bg-[#ba1a1a] text-white'
                        : tab.key === 'WARNING'
                          ? 'bg-amber-600 text-white'
                          : 'bg-[#0037b0] text-white'
                      : 'text-[#434655] hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 text-[10px] ${
                        activeTab === tab.key ? 'opacity-80' : 'text-gray-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="max-h-[600px] overflow-y-auto">
            {grouped.length > 0 ? (
              grouped.map(([label, items]) => (
                <div key={label}>
                  <div className="sticky top-0 z-10 px-5 py-2 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      {label}
                    </span>
                  </div>
                  {items.map((notif) => {
                    const cfg = TYPE_CONFIG[notif.type];
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-b-0 ${
                          notif.read
                            ? 'hover:bg-gray-50/50'
                            : 'bg-blue-50/30 hover:bg-blue-50/50'
                        }`}
                      >
                        {/* Type icon */}
                        <div
                          className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.text}`}
                        >
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm leading-snug ${
                                notif.read
                                  ? 'text-gray-700 font-medium'
                                  : 'text-gray-900 font-bold'
                              }`}
                            >
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-[#0037b0]" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                            {notif.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[10px] font-semibold ${cfg.text}`}>
                              {cfg.label}
                            </span>
                            <span className="text-gray-300">·</span>
                            <span className="text-[10px] text-gray-400 font-medium">
                              {relativeTime(notif.createdAt)}
                            </span>
                            {notif.link && (
                              <>
                                <span className="text-gray-300">·</span>
                                <span className="text-[10px] text-[#0037b0] font-semibold">
                                  View request →
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Inbox className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-700">No notifications</p>
                <p className="text-xs text-gray-400 mt-1 text-center max-w-xs">
                  {activeTab === 'UNREAD'
                    ? "You've read all your notifications. Nice work!"
                    : "Nothing here yet. Notifications will appear when there's activity on your requests."}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 text-[10px] text-gray-400 font-medium flex items-center justify-between">
            <span>Notifications older than 30 days are automatically removed.</span>
            <span>{notifications.length} total</span>
          </div>
        </div>
      )}

      {/* ── Settings Section ── */}
      {activeSection === 'settings' && (
        <div className="bg-white border border-[#c4c5d7] rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="font-sans font-bold text-sm text-[#191c1d] flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0037b0]" />
              Notification Preferences
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Control how and when you receive notifications.
            </p>
          </div>

          <div className="p-6 space-y-8 max-w-2xl">
            {/* Delivery channels */}
            <div className="space-y-5">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Delivery Channels
              </h4>

              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Push Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">Show notifications in the browser</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={pushNotifs}
                  aria-label="Push Notifications"
                  onClick={() => setPushNotifs(!pushNotifs)}
                  className={`relative w-11 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0037b0] focus-visible:ring-offset-2 cursor-pointer ${
                    pushNotifs ? 'bg-[#0037b0]' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      pushNotifs ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Email Summaries</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Receive a daily digest of activity
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailDigest}
                  aria-label="Email Summaries"
                  onClick={() => setEmailDigest(!emailDigest)}
                  className={`relative w-11 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0037b0] focus-visible:ring-offset-2 cursor-pointer ${
                    emailDigest ? 'bg-[#0037b0]' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      emailDigest ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Email Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Send an email for every new notification in real time
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotifs}
                  aria-label="Email Notifications"
                  onClick={() => setEmailNotifs(!emailNotifs)}
                  className={`relative w-11 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0037b0] focus-visible:ring-offset-2 cursor-pointer ${
                    emailNotifs ? 'bg-[#0037b0]' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      emailNotifs ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">WhatsApp Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Receive notifications via WhatsApp (requires a phone number on your profile)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={whatsappNotifs}
                  aria-label="WhatsApp Notifications"
                  onClick={() => setWhatsappNotifs(!whatsappNotifs)}
                  className={`relative w-11 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0037b0] focus-visible:ring-offset-2 cursor-pointer ${
                    whatsappNotifs ? 'bg-[#25d366]' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                      whatsappNotifs ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Triggers */}
            <div className="space-y-5">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Notification Triggers
              </h4>

              {([
                { key: 'newAssignments' as const, label: 'New Assignments', desc: 'When a research brief is assigned to you or your team' },
                { key: 'statusChanges' as const, label: 'Status Changes', desc: 'When a request moves to a new stage (draft, review, delivered)' },
                { key: 'draftMentions' as const, label: 'Draft Mentions', desc: 'When someone comments on or mentions you in a draft' },
                { key: 'deadlineReminders' as const, label: 'Deadline Reminders', desc: 'Warnings at 48h and 24h before a deadline' },
              ]).map(({ key, label, desc }) => (
                <label
                  key={key}
                  className="flex items-start gap-3 py-3 border-b border-gray-50 cursor-pointer select-none rounded transition-shadow focus-within:ring-2 focus-within:ring-[#0037b0] focus-within:ring-offset-2"
                >
                  <input
                    type="checkbox"
                    checked={triggers[key]}
                    onChange={() => handleToggleTrigger(key)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      triggers[key]
                        ? 'bg-[#0037b0] border-[#0037b0]'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {triggers[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </span>
                  <span>
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleSaveSettings}
              className="bg-[#0037b0] hover:bg-[#1d4ed8] text-white font-bold text-xs px-6 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
