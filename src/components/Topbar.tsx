import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Bell, HelpCircle, User as UserIcon, LogOut, Menu } from 'lucide-react';

interface TopbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  title?: string;
  onMenuClick?: () => void;
  onSignOut?: () => void;
  onSearchClick?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ currentView, onNavigate, title, onMenuClick, onSignOut, onSearchClick }) => {
  const { currentUser, notifications, logout } = useApp();
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-280px)] h-16 bg-white border-b border-[#c4c5d7] z-40 flex items-center justify-between px-4 sm:px-6 md:px-10">
      {/* Title & Search bar */}
      <div className="flex items-center gap-3 sm:gap-8 flex-1 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 text-[#434655] hover:text-[#0037b0] lg:hidden cursor-pointer"
            title="Open Navigation Menu"
          >
            <Menu className="w-5.5 h-5.5" />
          </button>
        )}
        <span className="font-sans font-bold text-sm sm:text-base md:text-lg text-[#191c1d] tracking-tight truncate">
          {title || "Research Portal"}
        </span>
        <div className="relative w-full max-w-md hidden md:block">
          <button
            onClick={onSearchClick}
            className="w-full bg-[#f3f4f5] border-none rounded-full pl-10 pr-4 py-2 text-sm text-left text-[#747686] hover:bg-[#ebedee] transition-all cursor-pointer flex items-center gap-2"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747686] w-4 h-4" />
            Search requests, briefs, or archives...
            <kbd className="ml-auto hidden lg:inline-flex text-[10px] font-mono bg-white text-gray-400 px-1.5 py-0.5 rounded border border-gray-200">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Navigation & Actions */}
      <div className="flex items-center gap-4 sm:gap-6 shrink-0">
        <nav className="hidden lg:flex items-center gap-8">
          <a href="#directives" className="font-sans font-medium text-sm text-[#434655] hover:text-[#0037b0] transition-colors">Directives</a>
          <a href="#committees" className="font-sans font-medium text-sm text-[#434655] hover:text-[#0037b0] transition-colors">Committees</a>
          <a href="#library" className="font-sans font-medium text-sm text-[#434655] hover:text-[#0037b0] transition-colors">Library</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4 lg:border-l lg:border-[#c4c5d7] lg:pl-6">
          {/* Notifications button */}
          <button 
            onClick={() => onNavigate('notifications')}
            className="text-[#434655] hover:text-[#0037b0] transition-colors relative p-1.5 rounded-full hover:bg-gray-100"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full border-2 border-white animate-pulse" />
            )}
          </button>

          {/* Help button */}
          <button className="text-[#434655] hover:text-[#0037b0] transition-colors p-1.5 rounded-full hover:bg-gray-100 hidden sm:block">
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* User profile dropdown and metadata */}
          <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
            <div className="text-right hidden xl:block">
              <p className="font-sans font-bold text-sm text-[#191c1d] leading-none">{currentUser.name}</p>
              <p className="text-[10px] text-[#434655] uppercase tracking-wider mt-1">{currentUser.title}</p>
            </div>
            
            <div className="relative cursor-pointer" ref={profileRef}>
              <div 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`w-9 h-9 rounded-full bg-[#dce1ff] border border-[#0037b5] flex items-center justify-center text-[#001551] font-bold text-sm transition-all ${isProfileOpen ? 'ring-2 ring-blue-200' : 'hover:ring-2 ring-blue-200'}`}
              >
                {currentUser.initials}
              </div>
              
              {/* Dropdown on click */}
              <div className={`absolute right-0 top-full mt-2 w-48 bg-white rounded-lg border border-[#c4c5d7] shadow-lg py-1 z-50 ${isProfileOpen ? 'block' : 'hidden'}`}>
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="font-sans font-bold text-xs text-gray-900">{currentUser.name}</p>
                  <p className="text-[10px] text-gray-500">{currentUser.email}</p>
                </div>
                <button 
                  onClick={() => { setIsProfileOpen(false); onNavigate('settings'); }}
                  className="w-full text-left px-4 py-2 text-xs text-[#191c1d] hover:bg-gray-100 flex items-center"
                >
                  <UserIcon className="w-3.5 h-3.5 mr-2" />
                  Account Settings
                </button>
                <button 
                  onClick={() => { 
                    setIsProfileOpen(false); 
                    logout();
                    if (onSignOut) onSignOut();
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-[#ba1a1a] hover:bg-red-50 flex items-center border-t border-gray-100"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
