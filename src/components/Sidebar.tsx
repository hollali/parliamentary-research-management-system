import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  FileText, 
  Layers, 
  BarChart3, 
  Users, 
  Archive, 
  Settings, 
  HelpCircle, 
  Plus, 
  BookOpen, 
  ShieldAlert,
  Calendar,
  Clock,
  Sparkles,
  X,
  ChevronLeft
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpenMobile, onCloseMobile, isCollapsed, onToggleCollapse }) => {
  const { currentUser, switchUser, requests } = useApp();

  const menuItems = [
    { id: 'dashboard', label: currentUser.role === 'RESEARCH_OFFICER' ? 'Officer Workflow' : 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'briefs', label: 'Legislative Briefs', icon: FileText, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'projects', label: 'Research Projects', icon: Layers, roles: ['ADMIN', 'MP'] },
    { id: 'statistics', label: 'Statistics', icon: BarChart3, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'notifications', label: 'Notifications', icon: ShieldAlert, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'members', label: 'Members', icon: Users, roles: ['ADMIN', 'MP'] },
    { id: 'archive', label: 'Archive', icon: Archive, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'committees', label: 'Committees', icon: Users, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'calendar', label: 'Calendar', icon: Calendar, roles: ['ADMIN', 'RESEARCH_OFFICER', 'MP'] },
    { id: 'templates', label: 'Templates', icon: FileText, roles: ['ADMIN', 'RESEARCH_OFFICER'] },
    { id: 'audit', label: 'Audit Log', icon: Clock, roles: ['ADMIN'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(currentUser.role));

  const handleMenuClick = (viewId: string) => {
    onNavigate(viewId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-[#3a485c] flex flex-col z-50 shadow-xl border-r border-[#4e5e74] transition-all duration-300 ease-in-out ${
      isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
    } ${isCollapsed ? 'lg:w-[80px] w-[280px]' : 'w-[280px]'}`}>
      {/* Brand Header */}
      <div className={`py-8 flex items-center relative ${isCollapsed ? 'px-0 justify-center' : 'px-6 justify-between gap-3'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center p-0.5 shadow-md shrink-0">
            <img 
              src="/logo.png" 
              alt="Parliament of Ghana" 
              className="w-9 h-9 object-contain"
              referrerPolicy="no-referrer" 
            />
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h1 className="font-sans font-bold text-lg text-white leading-tight tracking-tight whitespace-nowrap">PRRMS</h1>
              <p className="font-sans font-medium text-[10px] text-gray-300 uppercase tracking-widest whitespace-nowrap">
                Parliamentary Research
              </p>
            </div>
          )}
        </div>
        
        {/* Toggle Collapse Button (Desktop only) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`hidden lg:flex absolute top-10 -right-3 w-6 h-6 bg-[#0037b0] text-white rounded-full items-center justify-center shadow-md hover:bg-[#1d4ed8] transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-gray-300 hover:text-white hover:bg-[#2b384a]/50 lg:hidden cursor-pointer"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Primary Action Button — only for ADMIN and MP */}
      {(currentUser.role === 'ADMIN' || currentUser.role === 'MP') && (
        <div className={`mb-6 ${isCollapsed ? 'px-3' : 'px-4'}`}>
          <button 
            onClick={() => handleMenuClick('new_request')}
            className={`w-full bg-[#0037b0] text-white font-sans font-semibold py-3 rounded-lg hover:bg-[#1d4ed8] transition-all duration-200 shadow-md active:scale-[0.98] flex items-center justify-center cursor-pointer ${isCollapsed ? 'px-0' : 'px-4 gap-2'}`}
            title={isCollapsed ? "New Research Request" : undefined}
          >
            <Plus className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">New Research Request</span>}
          </button>
        </div>
      )}

      {/* Navigation Menu Links */}
      <nav aria-label="Main navigation" className="flex-1 px-2 space-y-1 overflow-y-auto">
        <ul>
          {filteredMenu.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleMenuClick(item.id)}
                  className={`w-full relative flex items-center py-3 rounded-md transition-all duration-150 group text-left cursor-pointer ${
                    isCollapsed ? 'justify-center px-0' : 'px-4'
                  } ${
                    isActive 
                      ? 'bg-[#1d4ed8] text-white font-semibold' 
                      : 'text-gray-300 hover:text-white hover:bg-[#2b384a]/50'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-[#0037b0] rounded-r-md" />
                  )}
                  <Icon className={`w-5 h-5 transition-colors shrink-0 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  } ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                  {!isCollapsed && <span className="font-sans text-sm whitespace-nowrap overflow-hidden">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Role Play Tester Panel (dev only) */}
      {import.meta.env.DEV && !isCollapsed && (
        <div className="mx-4 my-2 p-3 bg-[#2a3646] rounded-lg border border-[#445468] text-white space-y-2 overflow-hidden shrink-0">
          <p className="text-[11px] font-sans font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
            <Sparkles className="w-3 h-3 text-yellow-400 shrink-0" />
            Simulation Role Switcher
          </p>
          <div className="grid grid-cols-3 gap-1">
            <button 
              onClick={() => { switchUser('ADMIN'); onNavigate('dashboard'); }}
              className={`py-1 px-1 rounded text-[10px] font-bold text-center transition-all ${
                currentUser.role === 'ADMIN' ? 'bg-[#0037b0] text-white' : 'bg-[#3a485c] text-gray-300 hover:bg-[#4a5a70]'
              }`}
            >
              Admin
            </button>
            <button 
              onClick={() => { switchUser('RESEARCH_OFFICER'); onNavigate('dashboard'); }}
              className={`py-1 px-1 rounded text-[10px] font-bold text-center transition-all ${
                currentUser.role === 'RESEARCH_OFFICER' ? 'bg-[#0037b0] text-white' : 'bg-[#3a485c] text-gray-300 hover:bg-[#4a5a70]'
              }`}
            >
              Officer
            </button>
            <button 
              onClick={() => { switchUser('MP'); onNavigate('dashboard'); }}
              className={`py-1 px-1 rounded text-[10px] font-bold text-center transition-all ${
                currentUser.role === 'MP' ? 'bg-[#0037b0] text-white' : 'bg-[#3a485c] text-gray-300 hover:bg-[#4a5a70]'
              }`}
            >
              Member
            </button>
          </div>
          <p className="text-[9px] text-gray-400 text-center leading-normal">
            Toggle roles to instantly preview user workflows and dashboard pages.
          </p>
        </div>
      )}

      {/* Fixed Settings / Support Footers */}
      <div className={`border-t border-[#4e5e74]/50 mt-auto space-y-1 bg-[#2e3b4d] shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <button 
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center text-gray-300 hover:text-white py-2 rounded text-sm font-sans transition-colors ${
            isCollapsed ? 'justify-center px-0' : 'px-4 text-left'
          } ${currentView === 'settings' ? 'text-white bg-[#2b384a]' : ''}`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className={`w-4 h-4 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button 
          onClick={() => onNavigate('support')}
          className={`w-full flex items-center text-gray-300 hover:text-white py-2 rounded text-sm font-sans transition-colors ${
            isCollapsed ? 'justify-center px-0' : 'px-4 text-left'
          }`}
          title={isCollapsed ? "Support" : undefined}
        >
          <HelpCircle className={`w-4 h-4 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && <span>Support</span>}
        </button>
      </div>
    </aside>
  );
};
